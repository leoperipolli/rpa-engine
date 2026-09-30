import type { BackgroundMessage, BackgroundResponse } from './background.js';
import type { RecordedStep } from './types.js';
import { generateSelector } from './lib/selector.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isRpaElement(el: Element | null): boolean {
  if (!el) return false;
  return !!(el.closest('[id^="__rpa_"]') || (el as HTMLElement).id?.startsWith('__rpa_'));
}

// ── Module state ──────────────────────────────────────────────────────────────

/**
 * Elements that fired a `change` event during the current interaction.
 * Used to suppress the click step when an input/select also fires change.
 */
const changedElements = new WeakSet<Element>();

/** Last URL for which a navigate step was recorded — prevents duplicates. */
let lastRecordedUrl: string | null = null;

/** Timestamp of last click on (or inside) a link — suppresses the redundant navigate step. */
let lastLinkClickTs = 0;

/** Guard against attaching listeners more than once. */
let listenersAttached = false;

// ── Communication ─────────────────────────────────────────────────────────────

function sendToBackground(message: BackgroundMessage): Promise<BackgroundResponse> {
  return chrome.runtime.sendMessage(message);
}

async function addStep(step: RecordedStep): Promise<void> {
  try {
    await sendToBackground({ type: 'ADD_STEP', step });
  } catch (err) {
    console.warn('[RPA] Falha ao enviar step para o background:', err);
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────

async function recordNavigateIfNew(url: string): Promise<void> {
  if (url === lastRecordedUrl) return;
  // Suppress navigate when it was caused by a link click (click step already recorded)
  if (Date.now() - lastLinkClickTs < 2000) {
    lastRecordedUrl = url;
    return;
  }
  lastRecordedUrl = url;
  await addStep({ type: 'navigate', url, timestamp: Date.now() });
}

function patchHistory(): void {
  const originalPush = history.pushState.bind(history);
  const originalReplace = history.replaceState.bind(history);

  history.pushState = function (data, unused, url) {
    originalPush(data, unused, url);
    if (url) recordNavigateIfNew(String(url));
  };

  history.replaceState = function (data, unused, url) {
    originalReplace(data, unused, url);
    if (url) recordNavigateIfNew(String(url));
  };
}

// ── Event handlers ────────────────────────────────────────────────────────────

function onMousedown(event: Event): void {
  const el = event.target as Element | null;
  if (el && !isRpaElement(el)) changedElements.delete(el);
}

function onClick(event: Event): void {
  const el = event.target as Element | null;
  if (!el) return;

  // Suppress clicks on the RPA overlay (pick form)
  if (isRpaElement(el)) return;

  // Suppress click when element also fires change (input/select)
  if (changedElements.has(el)) return;

  const tag = el.tagName.toLowerCase();
  if (tag === 'select' || tag === 'option') return;

  if (tag === 'input') {
    const inputType = (el as HTMLInputElement).type.toLowerCase();
    const textTypes = ['text', 'email', 'password', 'search', 'tel', 'url', 'number'];
    if (textTypes.includes(inputType)) return;
  }

  if (tag === 'textarea') return;

  // If click is on or inside an <a>, mark it so the subsequent navigate is suppressed
  if (el.closest('a')) {
    lastLinkClickTs = Date.now();
  }

  const selector = generateSelector(el);
  addStep({ type: 'click', selector, timestamp: Date.now() });
}

function onChange(event: Event): void {
  const el = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
  if (!el) return;

  // Suppress changes on the RPA overlay (pick form)
  if (isRpaElement(el)) return;

  changedElements.add(el);

  const tag = el.tagName.toLowerCase();
  const selector = generateSelector(el);
  const timestamp = Date.now();

  if (tag === 'select') {
    addStep({ type: 'select', selector, value: el.value, timestamp });
  } else {
    addStep({ type: 'fill', selector, value: el.value, timestamp });
  }
}

function onPopstate(): void {
  recordNavigateIfNew(window.location.href);
}

// ── Pick mode ─────────────────────────────────────────────────────────────────

let isPickMode = false;
let pickHighlighted: Element | null = null;
let pickBanner: HTMLElement | null = null;
let pickForm: HTMLElement | null = null;

function enterPickMode(): void {
  if (isPickMode) return;
  isPickMode = true;
  showPickBanner();
  document.addEventListener('mouseover', onPickMouseover, true);
  document.addEventListener('mouseout', onPickMouseout, true);
  document.addEventListener('click', onPickClick, true);
  document.addEventListener('keydown', onPickKeydown, true);
}

function exitPickMode(): void {
  if (!isPickMode) return;
  isPickMode = false;
  clearPickHighlight();
  pickBanner?.remove(); pickBanner = null;
  pickForm?.remove(); pickForm = null;
  document.removeEventListener('mouseover', onPickMouseover, true);
  document.removeEventListener('mouseout', onPickMouseout, true);
  document.removeEventListener('click', onPickClick, true);
  document.removeEventListener('keydown', onPickKeydown, true);
}

function showPickBanner(): void {
  pickBanner = document.createElement('div');
  Object.assign(pickBanner.style, {
    position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)',
    zIndex: '2147483647', background: '#1e40af', color: '#fff',
    fontSize: '13px', fontFamily: 'system-ui,sans-serif', fontWeight: '500',
    padding: '8px 18px', borderRadius: '8px',
    boxShadow: '0 4px 14px rgba(0,0,0,0.25)', pointerEvents: 'none', whiteSpace: 'nowrap',
  });
  pickBanner.textContent = '🎯 Clique no elemento que quer extrair  •  ESC para cancelar';
  document.documentElement.appendChild(pickBanner);
}

function applyPickHighlight(el: Element): void {
  if (pickHighlighted === el) return;
  clearPickHighlight();
  pickHighlighted = el;
  const h = el as HTMLElement;
  h.style.outline = '2px solid #3b82f6';
  h.style.outlineOffset = '1px';
  h.style.backgroundColor = 'rgba(59,130,246,0.08)';
}

function clearPickHighlight(): void {
  if (!pickHighlighted) return;
  const h = pickHighlighted as HTMLElement;
  h.style.outline = '';
  h.style.outlineOffset = '';
  h.style.backgroundColor = '';
  pickHighlighted = null;
}

function onPickMouseover(event: Event): void {
  const el = event.target as Element;
  if (pickForm?.contains(el)) return;
  applyPickHighlight(el);
}

function onPickMouseout(event: Event): void {
  if (pickHighlighted === event.target) clearPickHighlight();
}

function onPickClick(event: Event): void {
  const el = event.target as Element;
  if (pickForm?.contains(el)) return; // let form handle its own clicks
  event.stopImmediatePropagation();
  event.preventDefault();
  clearPickHighlight();
  const selector = generateSelector(el);
  const matchCount = document.querySelectorAll(selector).length;
  showPickForm(selector, matchCount);
}

function onPickKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopImmediatePropagation();
    exitPickMode();
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showPickForm(selector: string, matchCount: number): void {
  pickForm?.remove();

  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%,-50%)', zIndex: '2147483647',
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)', padding: '20px', width: '320px',
    fontFamily: 'system-ui,sans-serif', fontSize: '13px', color: '#111',
  });
  el.innerHTML = `
    <div style="font-size:14px;font-weight:600;margin-bottom:14px">Extrair elemento</div>
    <div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:500;color:#6b7280;margin-bottom:4px">Seletor detectado</div>
      <div style="font-family:monospace;font-size:11px;background:#f3f4f6;padding:6px 8px;border-radius:5px;word-break:break-all;color:#374151">${escHtml(selector)}</div>
    </div>
    <div style="margin-bottom:12px">
      <label style="display:block;font-size:12px;font-weight:500;color:#374151;margin-bottom:4px">Nome da variável <span style="color:#ef4444">*</span></label>
      <input id="__rpa_varname__" type="text" placeholder="Ex: pedido, status, valor"
        style="width:100%;padding:7px 9px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:system-ui,sans-serif;outline:none;box-sizing:border-box" />
      <div id="__rpa_varerr__" style="font-size:11px;color:#ef4444;margin-top:3px;min-height:14px"></div>
    </div>
    <label style="display:flex;align-items:center;gap:8px;margin-bottom:16px;cursor:pointer;font-size:12px;color:#374151;user-select:none">
      <input id="__rpa_multiple__" type="checkbox" ${matchCount > 1 ? 'checked' : ''}
        style="width:14px;height:14px;cursor:pointer" />
      Múltiplos (${matchCount} elemento${matchCount !== 1 ? 's' : ''} encontrado${matchCount !== 1 ? 's' : ''})
    </label>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="__rpa_cancel__"
        style="padding:7px 14px;border:1px solid #d1d5db;border-radius:6px;background:#f9fafb;font-size:12px;font-weight:500;cursor:pointer;font-family:system-ui,sans-serif">
        Cancelar
      </button>
      <button id="__rpa_confirm__"
        style="padding:7px 14px;border:none;border-radius:6px;background:#3b82f6;color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:system-ui,sans-serif">
        Confirmar
      </button>
    </div>
  `;

  document.documentElement.appendChild(el);
  pickForm = el;

  const input = el.querySelector<HTMLInputElement>('#__rpa_varname__')!;
  const errDiv = el.querySelector<HTMLElement>('#__rpa_varerr__')!;
  const multipleCheck = el.querySelector<HTMLInputElement>('#__rpa_multiple__')!;
  const confirmBtn = el.querySelector<HTMLButtonElement>('#__rpa_confirm__')!;
  const cancelBtn = el.querySelector<HTMLButtonElement>('#__rpa_cancel__')!;

  input.focus();

  function confirm() {
    const varName = input.value.trim();
    if (!varName) { errDiv.textContent = 'Nome é obrigatório.'; input.focus(); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(varName)) {
      errDiv.textContent = 'Use apenas letras, números e underscore.';
      input.focus(); return;
    }
    addStep({ type: 'extract', name: varName, selector, multiple: multipleCheck.checked, timestamp: Date.now() });
    exitPickMode();
  }

  confirmBtn.addEventListener('click', (e) => { e.stopPropagation(); confirm(); });
  cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); exitPickMode(); });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') confirm();
    if (e.key === 'Escape') exitPickMode();
  });
}

// ── Attach / Detach ───────────────────────────────────────────────────────────

function attachEventListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;

  document.addEventListener('mousedown', onMousedown, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('change', onChange, true);
  window.addEventListener('popstate', onPopstate);

  patchHistory();

  recordNavigateIfNew(window.location.href);
}

function detachEventListeners(): void {
  if (!listenersAttached) return;
  listenersAttached = false;

  document.removeEventListener('mousedown', onMousedown, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('change', onChange, true);
  window.removeEventListener('popstate', onPopstate);
}

// ── Initialization ────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  try {
    const response = await sendToBackground({ type: 'GET_STATE' });
    if (!response.success) return;

    const data = response.data as { isRecording: boolean; steps: RecordedStep[] };
    if (!data.isRecording) return;

    // Recover lastRecordedUrl from storage so we don't duplicate navigate steps
    const steps = data.steps;
    if (steps.length > 0) {
      const last = steps[steps.length - 1];
      if (last.type === 'navigate') {
        lastRecordedUrl = last.url;
      }
    }

    attachEventListeners();
  } catch {
    // Extension context may not be ready on very early page loads; ignore.
  }
}

// ── Message listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: { type: string }) => {
  if (message.type === 'RECORDING_STARTED') {
    lastRecordedUrl = null;
    attachEventListeners();
  }
  if (message.type === 'RECORDING_STOPPED') {
    detachEventListeners();
    exitPickMode();
  }
  if (message.type === 'START_PICK') {
    enterPickMode();
  }
});

init();

export {};
