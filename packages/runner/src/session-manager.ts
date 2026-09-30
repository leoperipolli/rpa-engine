import type { Page } from 'playwright';
import type { SessionConfig } from '@rpa/types';
import { executeStep } from './step-executor.js';
import type { ExecutionContext } from './lib/interpolate.js';

// ─── Logger interface ─────────────────────────────────────────────────────────

/** Minimal logger interface — compatible with pino and console. */
export interface Logger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

// ─── Session check ────────────────────────────────────────────────────────────

/**
 * Returns true if the session check passes.
 * Supports two modes:
 * - selector: waits for a CSS selector to be visible (default 5 s timeout)
 * - js: evaluates a JavaScript expression; truthy result = active
 */
async function isSessionActive(page: Page, session: SessionConfig): Promise<boolean> {
  if (session.check.js) {
    try {
      const result = await page.evaluate(session.check.js);
      return !!result;
    } catch {
      return false;
    }
  }
  try {
    await page.waitForSelector(session.check.selector!, {
      state: 'visible',
      timeout: session.check.timeout ?? 5_000,
    });
    return true;
  } catch {
    return false;
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Executes all `login_steps` once, then verifies the session is active.
 * Throws a descriptive error if any step fails or the session check still
 * fails after login — does NOT retry to avoid infinite loops.
 */
async function runLogin(
  page: Page,
  session: SessionConfig,
  ctx: ExecutionContext,
  log: Logger,
): Promise<void> {
  const total = session.login_steps.length;
  log.warn(`[session] session expired — running ${total} login step(s)`);

  for (let i = 0; i < total; i++) {
    const step = session.login_steps[i];
    log.info(`[session] login step ${i + 1}/${total}: ${step.type}`);

    try {
      await executeStep(page, step, ctx);
    } catch (err) {
      // Strip the [step:type] prefix so the message is not double-prefixed
      const detail = err instanceof Error
        ? err.message.replace(/^\[step:\w+\] /, '')
        : String(err);
      throw new Error(
        `[session] login failed at step ${i + 1}/${total} (${step.type}): ${detail}`,
      );
    }
  }

  // Verify the session is now active — fail fast if not
  const active = await isSessionActive(page, session);
  if (!active) {
    throw new Error(
      `[session] login steps completed but session check failed — ` +
      `selector "${session.check.selector}" not found after login. ` +
      `Login may have been rejected (wrong credentials or unexpected redirect).`,
    );
  }

  log.info('[session] re-login successful — session is now active');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Ensures the session is active before executing recipe steps.
 *
 * - If the session check selector is found → proceeds immediately (debug log).
 * - If the check fails → runs `login_steps` once and re-checks.
 * - If login fails or the check still fails → throws (no retry).
 *
 * Pass `session: undefined` for recipes that don't require authentication.
 */
export async function ensureSession(
  page: Page,
  session: SessionConfig | undefined,
  ctx: ExecutionContext,
  log: Logger,
): Promise<void> {
  if (!session) {
    log.debug('[session] no session config — skipping check');
    return;
  }

  const active = await isSessionActive(page, session);

  if (active) {
    log.debug('[session] session is active');
    return;
  }

  await runLogin(page, session, ctx, log);
}
