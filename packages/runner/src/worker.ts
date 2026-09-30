import pg from 'pg';
import pino, { type Logger as PinoLogger } from 'pino';
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());
import type { Browser, Page } from 'playwright';
import { Worker } from 'bullmq';
import type { OutputDefinition, InputDefinition } from '@rpa/types';
import { config } from './config.js';
import { parseRedisUrl } from './lib/redis.js';
import { fetchRecipe } from './lib/db.js';
import { decryptSecrets } from './lib/crypto.js';
import { ensureSession, type Logger } from './session-manager.js';
import { executeStep, type StepOutput } from './step-executor.js';
import { interpolate, type ExecutionContext } from './lib/interpolate.js';
import type { JobData, JobResult } from './types.js';

// ─── Logger ───────────────────────────────────────────────────────────────────

export const log = pino({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    config.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

// Adapts a pino logger (child or root) to the session-manager's Logger interface
function pinoToLogger(p: PinoLogger): Logger {
  return {
    debug: (msg) => p.debug(msg),
    info:  (msg) => p.info(msg),
    warn:  (msg) => p.warn(msg),
    error: (msg) => p.error(msg),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveInputs(
  definitions: InputDefinition[],
  provided: Record<string, string>,
): Record<string, string> {
  const resolved = { ...provided };
  for (const def of definitions) {
    if (!(def.name in resolved)) {
      if (def.default !== undefined) {
        resolved[def.name] = def.default;
      } else if (def.required !== false) {
        throw new Error(`required input "${def.name}" not provided`);
      }
    }
  }
  return resolved;
}

function applyOutputs(
  rawResult: Record<string, unknown>,
  outputs: OutputDefinition | undefined,
): Record<string, unknown> {
  if (!outputs) return rawResult;
  return Object.fromEntries(
    Object.entries(outputs).map(([key, stepName]) => [key, rawResult[stepName]]),
  );
}

function isBrowserCrash(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('target closed') ||
    msg.includes('browser has been closed') ||
    msg.includes('browser closed') ||
    msg.includes('context has been closed') ||
    msg.includes('page has been closed')
  );
}

// ─── Browser lifecycle ────────────────────────────────────────────────────────

let browser: Browser | null = null;
let activePage: Page | null = null;
let activeHttpCreds: string | null = null;

async function safeCloseBrowser(): Promise<void> {
  try {
    await browser?.close();
  } catch { /* ignore errors on a crashed browser */ }
  browser = null;
  activePage = null;
  activeHttpCreds = null;
}

interface GetPageOptions {
  httpCredentials?: { username: string; password: string };
}

async function getPage(opts?: GetPageOptions): Promise<Page> {
  const credsKey = opts?.httpCredentials
    ? `${opts.httpCredentials.username}:${opts.httpCredentials.password}`
    : null;

  // If credentials changed we must recreate the context
  if (browser && activePage && credsKey !== activeHttpCreds) {
    log.info('[browser] options changed - recreating context');
    await safeCloseBrowser();
  }

  if (browser && activePage) {
    try {
      await activePage.evaluate(() => true); // liveness probe
      return activePage;
    } catch {
      log.warn('[browser] page unresponsive, relaunching');
      await safeCloseBrowser();
    }
  }

  log.info('[browser] launching Chromium');
  browser = await chromium.launch({
    headless: config.PLAYWRIGHT_HEADLESS,
  });
  if (!browser) throw new Error('[browser] chromium.launch() returned null');

  const context = await browser.newContext({
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    viewport: { width: 1920, height: 1080 },
    ...(opts?.httpCredentials ? { httpCredentials: opts.httpCredentials } : {}),
  });
  activePage = await context.newPage();
  activeHttpCreds = credsKey;
  log.info('[browser] ready');
  return activePage;
}

// ─── Worker factory ───────────────────────────────────────────────────────────

export interface WorkerHandle {
  worker: Worker<JobData, JobResult>;
  shutdown: () => Promise<void>;
}

export function createWorker(): WorkerHandle {
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
  const connection = parseRedisUrl(config.REDIS_URL);

  // ── Job processor ──────────────────────────────────────────────────────────
  const processor = async (job: { data: JobData; attemptsMade: number }): Promise<JobResult> => {
    const { execution_id, recipe_id, inputs } = job.data;
    const jobLog = log.child({ execution_id, attempt: job.attemptsMade + 1 });

    jobLog.info('[worker] processing job');
    const startedAt = Date.now();

    // 1. Fetch recipe (steps + session + encrypted secrets)
    const recipe = await fetchRecipe(pool, recipe_id);
    if (!recipe) throw new Error(`recipe ${recipe_id} not found in database`);

    // 2. Build execution context
    const secrets = decryptSecrets(recipe.secrets_encrypted);
    const resolvedInputs = resolveInputs(recipe.inputs, inputs);
    const ctx: ExecutionContext = { inputs: resolvedInputs, secrets };

    // 3. Resolve HTTP Basic Auth credentials (if configured)
    const httpCreds = recipe.session?.http_credentials;
    const resolvedHttpCreds = httpCreds
      ? {
          username: interpolate(httpCreds.username, ctx),
          password: interpolate(httpCreds.password, ctx),
        }
      : undefined;

    // 4. Obtain a live browser page
    let page: Page;
    try {
      page = await getPage({ httpCredentials: resolvedHttpCreds });
    } catch (err) {
      jobLog.error(err, '[worker] failed to launch browser');
      throw err;
    }

    // 5. Ensure session is active (re-login if needed)
    try {
      await ensureSession(page, recipe.session, ctx, pinoToLogger(jobLog));
    } catch (err) {
      if (isBrowserCrash(err)) {
        jobLog.error('[worker] browser crash during session check — relaunching');
        await safeCloseBrowser();
      }
      throw err;
    }

    // 6. Execute recipe steps, accumulating extracted data
    const rawResult: Record<string, unknown> = {};

    for (let i = 0; i < recipe.steps.length; i++) {
      const step = recipe.steps[i];
      jobLog.info(`[worker] step ${i + 1}/${recipe.steps.length}: ${step.type}`);

      try {
        const stepOutput: StepOutput = await executeStep(page, step, ctx);
        Object.assign(rawResult, stepOutput.result);
        if (stepOutput.newPage) {
          jobLog.info('[worker] click opened a new tab — switching to it');
          page = stepOutput.newPage;
        }
      } catch (err) {
        if (isBrowserCrash(err)) {
          jobLog.error('[worker] browser crash during step — relaunching');
          await safeCloseBrowser();
        }
        throw err;
      }
    }

    // 7. Navigate away so the page doesn't keep showing the target system
    await page.goto('about:blank').catch(() => {});

    // 8. Apply outputs mapping (if defined)
    const result = applyOutputs(rawResult, recipe.outputs);
    const duration_ms = Date.now() - startedAt;

    jobLog.info({ duration_ms }, '[worker] job completed');
    return { result, duration_ms };
  };

  // ── BullMQ Worker ──────────────────────────────────────────────────────────
  const worker = new Worker<JobData, JobResult>('rpa', processor, {
    connection,
    concurrency: config.WORKER_CONCURRENCY,
  });

  worker.on('failed', (job, err) => {
    log.error(
      {
        execution_id: job?.data.execution_id,
        attempt: job?.attemptsMade,
        error: err.message,
      },
      '[worker] job failed',
    );
  });

  log.info(
    { queue: 'rpa', concurrency: config.WORKER_CONCURRENCY },
    '[worker] started — waiting for jobs',
  );

  // ── Shutdown ──────────────────────────────────────────────────────────────
  const shutdown = async (): Promise<void> => {
    log.info('[worker] shutting down...');
    await worker.close();
    await pool.end();
    await safeCloseBrowser();
    log.info('[worker] shutdown complete');
  };

  return { worker, shutdown };
}
