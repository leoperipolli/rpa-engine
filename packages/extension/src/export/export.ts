import type { RecordedStep } from '../types.js';
import {
  buildRecipe,
  type ExportConfig,
  type StepConfig,
  type StepKind,
} from '../lib/recipe-builder.js';

// ── DOM references ────────────────────────────────────────────────────────────

const stepsList = document.getElementById('steps-list') as HTMLDivElement;
const recipeName = document.getElementById('recipe-name') as HTMLInputElement;
const recipeDesc = document.getElementById('recipe-desc') as HTMLInputElement;
const sessionEnable = document.getElementById('session-enable') as HTMLInputElement;
const sessionFields = document.getElementById('session-fields') as HTMLDivElement;
const sessionFrom = document.getElementById('session-from') as HTMLInputElement;
const sessionTo = document.getElementById('session-to') as HTMLInputElement;
const sessionSelector = document.getElementById('session-selector') as HTMLInputElement;
const btnDownload = document.getElementById('btn-download') as HTMLButtonElement;
const feedback = document.getElementById('feedback') as HTMLDivElement;
const errName = document.getElementById('err-name') as HTMLDivElement;
const errSession = document.getElementById('err-session') as HTMLDivElement;

// ── State ─────────────────────────────────────────────────────────────────────

let recordedSteps: RecordedStep[] = [];

// ── Rendering ─────────────────────────────────────────────────────────────────

function badgeClass(type: string): string {
  return `step-badge badge-${type}`;
}

function stepSummary(step: RecordedStep): string {
  switch (step.type) {
    case 'navigate':
      return `<span class="value">${escHtml(step.url)}</span>`;
    case 'click':
      return `<span class="selector">${escHtml(step.selector)}</span>`;
    case 'fill':
      return `<span class="selector">${escHtml(step.selector)}</span>
              &nbsp;→&nbsp;<span class="value">&quot;${escHtml(step.value)}&quot;</span>`;
    case 'select':
      return `<span class="selector">${escHtml(step.selector)}</span>
              &nbsp;→&nbsp;<span class="value">&quot;${escHtml(step.value)}&quot;</span>`;
    case 'extract':
      return `<span class="value">${escHtml(step.name)}</span>
              &nbsp;←&nbsp;<span class="selector">${escHtml(step.selector)}</span>
              ${step.multiple ? '&nbsp;<span class="extract-tag">múltiplos</span>' : ''}`;
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderSteps(steps: RecordedStep[]): void {
  if (steps.length === 0) {
    stepsList.innerHTML = '<div class="empty-state">Nenhum step gravado.</div>';
    return;
  }

  stepsList.innerHTML = '';

  steps.forEach((step, i) => {
    const hasValue = step.type === 'fill' || step.type === 'select';

    const div = document.createElement('div');
    div.className = 'step';
    div.innerHTML = `
      <div class="step-header">
        <span class="step-index">${i + 1}</span>
        <span class="${badgeClass(step.type)}">${step.type}</span>
        <span class="step-content">${stepSummary(step)}</span>
      </div>
      ${hasValue ? `
      <div class="step-controls" id="ctrl-${i}">
        <div class="radio-group">
          <label>
            <input type="radio" name="kind-${i}" value="literal" checked />
            Literal
          </label>
          <label>
            <input type="radio" name="kind-${i}" value="input" />
            Input
          </label>
          <label>
            <input type="radio" name="kind-${i}" value="secret" />
            Secret
          </label>
        </div>
        <div class="var-name-field" id="varfield-${i}">
          <label for="varname-${i}">Nome da variável</label>
          <input type="text" id="varname-${i}" placeholder="Ex: usuario, senha, codigo"
                 pattern="[a-zA-Z0-9_]+" title="Apenas letras, números e underscore" />
          <div class="error-msg" id="err-var-${i}"></div>
        </div>
      </div>
      ` : ''}
    `;

    stepsList.appendChild(div);

    if (hasValue) {
      const radios = div.querySelectorAll<HTMLInputElement>(`input[name="kind-${i}"]`);
      const varField = div.querySelector<HTMLDivElement>(`#varfield-${i}`)!;
      radios.forEach((r) => {
        r.addEventListener('change', () => {
          if (r.value === 'literal') {
            varField.classList.remove('visible');
          } else {
            varField.classList.add('visible');
          }
        });
      });
    }
  });

  // Update session range max values
  sessionFrom.max = String(steps.length);
  sessionTo.max = String(steps.length);
  if (Number(sessionTo.value) > steps.length) sessionTo.value = String(steps.length);
}

// ── Validation & config extraction ───────────────────────────────────────────

function clearErrors(): void {
  errName.textContent = '';
  errSession.textContent = '';
  document.querySelectorAll('.error-msg[id^="err-var-"]').forEach((el) => {
    (el as HTMLElement).textContent = '';
  });
  document.querySelectorAll('input.error').forEach((el) => el.classList.remove('error'));
}

function getConfig(): ExportConfig | null {
  clearErrors();
  let valid = true;

  const name = recipeName.value.trim() || 'unnamed';

  const stepConfigs: Record<number, StepConfig> = {};
  recordedSteps.forEach((step, i) => {
    if (step.type !== 'fill' && step.type !== 'select') return;

    const radios = document.querySelectorAll<HTMLInputElement>(`input[name="kind-${i}"]`);
    let kind: StepKind = 'literal';
    radios.forEach((r) => { if (r.checked) kind = r.value as StepKind; });

    if (kind === 'literal') {
      stepConfigs[i] = { kind };
      return;
    }

    const varInput = document.getElementById(`varname-${i}`) as HTMLInputElement | null;
    const varName = varInput?.value.trim() ?? '';
    const errDiv = document.getElementById(`err-var-${i}`) as HTMLElement | null;

    if (!varName) {
      if (errDiv) errDiv.textContent = 'Nome da variável é obrigatório.';
      if (varInput) varInput.classList.add('error');
      valid = false;
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(varName)) {
      if (errDiv) errDiv.textContent = 'Use apenas letras, números e underscore.';
      if (varInput) varInput.classList.add('error');
      valid = false;
      return;
    }

    stepConfigs[i] = { kind, variableName: varName };
  });

  let session: ExportConfig['session'] | undefined;
  if (sessionEnable.checked) {
    const from = parseInt(sessionFrom.value, 10);
    const to = parseInt(sessionTo.value, 10);
    const sel = sessionSelector.value.trim();

    if (!sel) {
      errSession.textContent = 'Seletor CSS é obrigatório quando sessão está habilitada.';
      sessionSelector.classList.add('error');
      valid = false;
    } else if (from < 1 || to < from || to > recordedSteps.length) {
      errSession.textContent = `Intervalo inválido. Deve ser entre 1 e ${recordedSteps.length}.`;
      valid = false;
    } else {
      session = { loginFrom: from, loginTo: to, checkSelector: sel };
    }
  }

  if (!valid) return null;

  return {
    name,
    description: recipeDesc.value.trim() || undefined,
    stepConfigs,
    session,
  };
}

// ── Actions ───────────────────────────────────────────────────────────────────

function showFeedback(msg: string, type: 'success' | 'error'): void {
  feedback.textContent = msg;
  feedback.className = type;
  feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideFeedback(): void {
  feedback.className = '';
  feedback.textContent = '';
}

btnDownload.addEventListener('click', async () => {
  hideFeedback();
  const config = getConfig();
  if (!config) return;

  const payload = buildRecipe(recordedSteps, config);
  const json = JSON.stringify(payload, null, 2);

  try {
    await navigator.clipboard.writeText(json);
    showFeedback('JSON copiado para a área de transferência.', 'success');
  } catch {
    // Fallback via textarea + execCommand (funciona em páginas de extensão MV3)
    const ta = document.createElement('textarea');
    ta.value = json;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) {
      showFeedback('JSON copiado para a área de transferência.', 'success');
    } else {
      showFeedback('Não foi possível copiar. Tente novamente.', 'error');
    }
  }
});

// ── Session toggle ────────────────────────────────────────────────────────────

sessionEnable.addEventListener('change', () => {
  sessionFields.classList.toggle('visible', sessionEnable.checked);
});

// ── Initialization ────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  const local = await chrome.storage.local.get(['steps']);
  recordedSteps = Array.isArray(local.steps) ? (local.steps as RecordedStep[]) : [];
  renderSteps(recordedSteps);
}

init();
