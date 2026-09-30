import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { Page } from 'playwright';
import type { Step } from '@rpa/types';
import { interpolate, type ExecutionContext } from './lib/interpolate.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Data produced by steps that extract content (extract, screenshot, download). */
export type StepResult = Record<string, unknown>;

/** Result of executeStep — includes optional newPage when a click opens a new tab. */
export interface StepOutput {
  result: StepResult;
  newPage?: Page;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Executes a single step against a Playwright page.
 * Throws an error with `[step:<type>]` prefix if the step fails.
 */
export async function executeStep(
  page: Page,
  step: Step,
  ctx: ExecutionContext,
): Promise<StepOutput> {
  try {
    switch (step.type) {
      case 'navigate':   return wrap(await doNavigate(page, step, ctx));
      case 'click':      return await doClick(page, step, ctx);
      case 'hover':      return wrap(await doHover(page, step, ctx));
      case 'fill':       return wrap(await doFill(page, step, ctx));
      case 'select':     return wrap(await doSelect(page, step, ctx));
      case 'wait':       return wrap(await doWait(page, step));
      case 'extract':    return wrap(await doExtract(page, step, ctx));
      case 'screenshot': return wrap(await doScreenshot(page, step));
      case 'download':   return wrap(await doDownload(page, step, ctx));
      case 'upload':     return wrap(await doUpload(page, step, ctx));
      case 'pbi_export': return wrap(await doPbiExport(page, step, ctx));
    }
  } catch (err) {
    if ('optional' in step && step.optional) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[debug:optional] step ${step.type} skipped (${msg.substring(0, 120)})`);
      return { result: {} };
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[step:${step.type}] ${msg}`);
  }
}

function wrap(result: StepResult): StepOutput {
  return { result };
}

// ─── Frame resolution ────────────────────────────────────────────────────────

type FrameLike = Page | import('playwright').Frame;

/**
 * Finds the frame (or page itself) that contains the given selector.
 * Checks the main page first, then all child frames (iframes).
 * Returns the matching frame, or falls back to the page if not found anywhere.
 */
async function resolveFrame(page: Page, selector: string, timeout: number): Promise<FrameLike> {
  // Quick check on main page first (short timeout)
  const probeTimeout = Math.min(2_000, timeout);
  const mainHit = await page.$(selector).catch(() => null);
  if (mainHit) return page;

  // Search all child frames
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    const hit = await frame.$(selector).catch(() => null);
    if (hit) return frame;
  }

  // Not found yet — wait a bit and retry frames (element might still be loading)
  await page.waitForTimeout(probeTimeout);
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    const hit = await frame.$(selector).catch(() => null);
    if (hit) return frame;
  }

  // Fallback to page (will timeout with a clear error)
  return page;
}

// ─── Step handlers ────────────────────────────────────────────────────────────

async function doNavigate(
  page: Page,
  step: Extract<Step, { type: 'navigate' }>,
  ctx: ExecutionContext,
): Promise<StepResult> {
  const url = interpolate(step.url, ctx);
  const waitUntil = step.waitUntil ?? 'load';
  console.log(`[debug:navigate] goto "${url}" waitUntil="${waitUntil}"`);
  const response = await page.goto(url, { waitUntil });
  console.log(`[debug:navigate] response status=${response?.status()} url=${response?.url()}`);
  console.log(`[debug:navigate] page.url()="${page.url()}" title="${await page.title()}"`);
  return {};
}

async function doClick(
  page: Page,
  step: Extract<Step, { type: 'click' }>,
  ctx: ExecutionContext,
): Promise<StepOutput> {
  const selector = interpolate(step.selector, ctx);
  const timeout = step.timeout ?? 30_000;
  const target = await resolveFrame(page, selector, timeout);

  // Listen for popup (new tab/window) before clicking
  const popupPromise = page.context().waitForEvent('page', { timeout: 3_000 }).catch(() => null);

  await target.locator(selector).click({ timeout });

  const newPage = await popupPromise;

  if (newPage) {
    await newPage.waitForLoadState('load');
    return { result: {}, newPage };
  }

  return { result: {} };
}

async function doHover(
  page: Page,
  step: Extract<Step, { type: 'hover' }>,
  ctx: ExecutionContext,
): Promise<StepResult> {
  const selector = interpolate(step.selector, ctx);
  const timeout = step.timeout ?? 30_000;
  const target = await resolveFrame(page, selector, timeout);
  await target.locator(selector).hover({ timeout });
  return {};
}

async function doFill(
  page: Page,
  step: Extract<Step, { type: 'fill' }>,
  ctx: ExecutionContext,
): Promise<StepResult> {
  const selector = interpolate(step.selector, ctx);
  const value = interpolate(step.value, ctx);
  const timeout = step.timeout ?? 30_000;
  const target = await resolveFrame(page, selector, timeout);
  await target.waitForSelector(selector, { timeout });

  if (step.typeMode) {
    // Click to focus, select all existing text, then type key-by-key.
    // This fires keydown/keypress/keyup per character — required for
    // ASP.NET WebForms, SSRS ReportViewer, and similar legacy controls.
    const locator = target.locator(selector);
    await locator.click({ timeout });
    await locator.press('Control+a', { timeout });
    await locator.pressSequentially(value, { delay: 50 });
    // Trigger blur so onchange fires
    await locator.press('Tab');
  } else {
    await target.fill(selector, value, { timeout });
  }
  return {};
}

async function doSelect(
  page: Page,
  step: Extract<Step, { type: 'select' }>,
  ctx: ExecutionContext,
): Promise<StepResult> {
  const selector = interpolate(step.selector, ctx);
  const value = interpolate(step.value, ctx);
  const timeout = step.timeout ?? 30_000;
  const target = await resolveFrame(page, selector, timeout);
  await target.waitForSelector(selector, { timeout });
  await target.selectOption(selector, value, { timeout });
  return {};
}

async function doWait(
  page: Page,
  step: Extract<Step, { type: 'wait' }>,
): Promise<StepResult> {
  if (!step.selector && step.ms === undefined) {
    throw new Error('Either selector or ms must be provided');
  }

  if (step.selector) {
    const state = step.hidden ? 'hidden' : 'visible';
    const timeout = step.timeout ?? 30_000;
    const target = await resolveFrame(page, step.selector, timeout);
    await target.waitForSelector(step.selector, { state, timeout });
  } else {
    await page.waitForTimeout(step.ms!);
  }
  return {};
}

async function doExtract(
  page: Page,
  step: Extract<Step, { type: 'extract' }>,
  ctx: ExecutionContext,
): Promise<StepResult> {
  const selector = interpolate(step.selector, ctx);
  const timeout = step.timeout ?? 30_000;
  console.log(`[debug:extract] selector="${selector}" multiple=${step.multiple} attribute=${step.attribute} timeout=${timeout}`);
  console.log(`[debug:extract] current url="${page.url()}" title="${await page.title()}"`);

  // Debug: check what's on the page before waiting
  const matchCount = await page.$$eval(selector, (els) => els.length).catch(() => -1);
  console.log(`[debug:extract] elements matching selector RIGHT NOW: ${matchCount}`);

  if (matchCount <= 0) {
    // Dump some page structure to help diagnose
    const bodySnippet = await page.evaluate(() => {
      // eslint-disable-next-line no-undef
      const body = (globalThis as any).document.body;
      if (!body) return '<no body>';
      const html = body.innerHTML;
      return html.length > 3000 ? html.substring(0, 3000) + '...[truncated]' : html;
    }).catch(() => '<evaluate failed>');
    console.log(`[debug:extract] page body snippet:\n${bodySnippet}`);

    // Also check if there are frames/iframes
    const frameCount = page.frames().length;
    console.log(`[debug:extract] page has ${frameCount} frame(s)`);
    for (const frame of page.frames()) {
      console.log(`[debug:extract]   frame: name="${frame.name()}" url="${frame.url()}"`);
      const frameMatch = await frame.$$eval(selector, (els) => els.length).catch(() => -1);
      if (frameMatch > 0) {
        console.log(`[debug:extract]   >>> FOUND ${frameMatch} match(es) IN THIS FRAME! <<<`);
      }
    }
  }

  const target = await resolveFrame(page, selector, timeout);
  console.log(`[debug:extract] calling waitForSelector...`);
  await target.waitForSelector(selector, { timeout });
  console.log(`[debug:extract] selector found!`);

  let value: string | string[];

  if (step.multiple) {
    if (step.attribute === 'innerHTML') {
      value = await target.$$eval(selector, (els) => els.map((el) => el.innerHTML));
    } else if (step.attribute === 'outerHTML') {
      value = await target.$$eval(selector, (els) => els.map((el) => el.outerHTML));
    } else if (step.attribute) {
      const attr = step.attribute;
      value = await target.$$eval(
        selector,
        (els, a) => els.map((el) => el.getAttribute(a) ?? ''),
        attr,
      );
    } else {
      value = await target.$$eval(selector, (els) =>
        els.map((el) => el.textContent?.trim() ?? ''),
      );
    }
  } else {
    if (step.attribute === 'innerHTML') {
      value = await target.$eval(selector, (el) => el.innerHTML);
    } else if (step.attribute === 'outerHTML') {
      value = await target.$eval(selector, (el) => el.outerHTML);
    } else if (step.attribute) {
      value = (await target.getAttribute(selector, step.attribute)) ?? '';
    } else {
      value = ((await target.textContent(selector)) ?? '').trim();
    }
  }

  console.log(`[debug:extract] extracted value: ${JSON.stringify(value).substring(0, 500)}`);
  return { [step.name]: value };
}

async function doScreenshot(
  page: Page,
  step: Extract<Step, { type: 'screenshot' }>,
): Promise<StepResult> {
  const buffer = await page.screenshot({ fullPage: step.fullPage ?? false });
  const name = step.name ?? 'screenshot';
  return { [name]: buffer.toString('base64') };
}

async function doDownload(
  page: Page,
  step: Extract<Step, { type: 'download' }>,
  ctx: ExecutionContext,
): Promise<StepResult> {
  const selector = interpolate(step.selector, ctx);
  const timeout = step.timeout ?? 30_000;
  const target = await resolveFrame(page, selector, timeout);

  // waitForEvent('download') only exists on Page, not Frame.
  // Click in the correct frame but listen for download on the page.
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout }),
    target.locator(selector).click({ timeout }),
  ]);

  const filePath = await download.path();
  if (!filePath) {
    throw new Error('Download failed: path unavailable (download may have been cancelled)');
  }

  const buffer = await fs.readFile(filePath);
  const name = step.name ?? 'download';
  return { [name]: buffer.toString('base64') };
}

async function doUpload(
  page: Page,
  step: Extract<Step, { type: 'upload' }>,
  ctx: ExecutionContext,
): Promise<StepResult> {
  const selector = interpolate(step.selector, ctx);
  const tempFiles: string[] = [];

  const resolvedFiles = await Promise.all(
    step.files.map(async (f) => {
      const resolved = interpolate(f, ctx);
      if (resolved.startsWith('base64:')) {
        const data = Buffer.from(resolved.slice(7), 'base64');
        const tmpPath = path.join(
          os.tmpdir(),
          `rpa_upload_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        );
        await fs.writeFile(tmpPath, data);
        tempFiles.push(tmpPath);
        return tmpPath;
      }
      return resolved;
    }),
  );

  // file inputs may be hidden; use 'attached' so Playwright can set them
  await page.waitForSelector(selector, {
    state: 'attached',
    timeout: step.timeout,
  });
  await page.setInputFiles(selector, resolvedFiles, { timeout: step.timeout });

  // clean up any temp files written for base64 uploads
  await Promise.allSettled(tempFiles.map((f) => fs.unlink(f)));

  return {};
}

// ─── Power BI export ──────────────────────────────────────────────────────────

async function doPbiExport(
  page: Page,
  step: Extract<Step, { type: 'pbi_export' }>,
  ctx: ExecutionContext,
): Promise<StepResult> {
  const url = interpolate(step.url, ctx);
  const body = interpolate(step.body, ctx);
  const timeout = step.timeout ?? 120_000;
  const name = step.name ?? 'pbi_export';

  console.log(`[pbi_export] page.url()="${page.url()}"`);
  console.log(`[pbi_export] target url="${url}"`);
  console.log(`[pbi_export] body length=${body.length} timeout=${timeout} name="${name}"`);

  // Dump sessionStorage keys to help debug token extraction
  const ssDebug = await page.evaluate(`(() => {
    const ss = window.sessionStorage;
    const keys = [];
    for (let i = 0; i < ss.length; i++) {
      const key = ss.key(i);
      if (!key) continue;
      try {
        const val = JSON.parse(ss.getItem(key));
        keys.push({ key: key.substring(0, 80), credentialType: val.credentialType || null, hasSecret: !!val.secret, target: (val.target || '').substring(0, 60) });
      } catch {
        keys.push({ key: key.substring(0, 80), credentialType: null, hasSecret: false, target: '' });
      }
    }
    return JSON.stringify(keys);
  })()`) as string;
  console.log(`[pbi_export] sessionStorage entries: ${ssDebug}`);

  // Extract Bearer token from MSAL cache in sessionStorage (runs in browser context)
  const token = await page.evaluate(`(() => {
    const ss = window.sessionStorage;
    // First pass: prefer token scoped to Power BI API
    for (let i = 0; i < ss.length; i++) {
      const key = ss.key(i);
      if (!key) continue;
      try {
        const val = JSON.parse(ss.getItem(key));
        if (val.credentialType === 'AccessToken' && val.secret) {
          if (key.includes('analysis.windows.net') || (val.target && val.target.includes('analysis.windows.net'))) {
            return val.secret;
          }
        }
      } catch {}
    }
    // Fallback: any MSAL access token
    for (let i = 0; i < ss.length; i++) {
      const key = ss.key(i);
      if (!key) continue;
      try {
        const val = JSON.parse(ss.getItem(key));
        if (val.credentialType === 'AccessToken' && val.secret) {
          return val.secret;
        }
      } catch {}
    }
    return null;
  })()`) as string | null;

  if (!token) {
    throw new Error('Could not find MSAL access token in sessionStorage. Ensure the page is fully loaded.');
  }

  console.log(`[pbi_export] token found (${token.length} chars), expires check skipped`);
  console.log(`[pbi_export] calling POST ${url}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'Authorization': `Bearer ${token}`,
      },
      body,
      signal: controller.signal,
    });

    console.log(`[pbi_export] response status=${response.status} contentType="${response.headers.get('content-type')}"`);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.log(`[pbi_export] ERROR body: ${text.substring(0, 1000)}`);
      throw new Error(`Export API returned ${response.status}: ${text.substring(0, 500)}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    console.log(`[pbi_export] SUCCESS - received ${buffer.length} bytes (${(buffer.length / 1024).toFixed(1)} KB)`);
    return { [name]: buffer.toString('base64') };
  } finally {
    clearTimeout(timer);
  }
}
