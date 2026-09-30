// ── DOM refs ──────────────────────────────────────────────────────────────────

const runnerUrl = document.getElementById('runner-url') as HTMLInputElement;
const runnerKey = document.getElementById('runner-key') as HTMLInputElement;
const btnConnect = document.getElementById('btn-connect') as HTMLButtonElement;
const feedback = document.getElementById('feedback') as HTMLDivElement;
const recipesSection = document.getElementById('recipes-section') as HTMLDivElement;
const recipesList = document.getElementById('recipes-list') as HTMLDivElement;
const configSection = document.getElementById('config-section') as HTMLDivElement;
const cfgUrl = document.getElementById('cfg-url') as HTMLInputElement;
const cfgRecipeId = document.getElementById('cfg-recipe-id') as HTMLInputElement;
const cfgApiKey = document.getElementById('cfg-api-key') as HTMLInputElement;
const inputsSection = document.getElementById('inputs-section') as HTMLDivElement;
const inputsList = document.getElementById('inputs-list') as HTMLDivElement;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Recipe {
  id: string;
  name: string;
  description?: string;
  inputs: Array<{ name: string; required: boolean }>;
}

// ── Feedback ─────────────────────────────────────────────────────────────────

function showFeedback(msg: string, type: 'success' | 'error'): void {
  feedback.textContent = msg;
  feedback.className = type;
  feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideFeedback(): void {
  feedback.className = '';
  feedback.textContent = '';
}

// ── Recipes ───────────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderRecipes(recipes: Recipe[]): void {
  recipesSection.classList.add('visible');

  if (recipes.length === 0) {
    recipesList.innerHTML = '<div class="empty-state">Nenhuma receita encontrada.</div>';
    return;
  }

  recipesList.innerHTML = '';
  recipes.forEach((recipe) => {
    const card = document.createElement('div');
    card.className = 'recipe-card';
    const inputCount = recipe.inputs?.length ?? 0;
    card.innerHTML = `
      <div class="recipe-name">${escHtml(recipe.name)}</div>
      <div class="recipe-meta">${inputCount} input${inputCount !== 1 ? 's' : ''}${recipe.description ? ` · ${escHtml(recipe.description)}` : ''}</div>
    `;
    card.addEventListener('click', () => {
      document.querySelectorAll('.recipe-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      selectRecipe(recipe);
    });
    recipesList.appendChild(card);
  });
}

function selectRecipe(recipe: Recipe): void {
  const baseUrl = runnerUrl.value.trim().replace(/\/$/, '');
  cfgUrl.value = `${baseUrl}/api/executions`;
  cfgRecipeId.value = recipe.id;
  cfgApiKey.value = runnerKey.value.trim();

  // Show inputs
  if (recipe.inputs && recipe.inputs.length > 0) {
    inputsSection.style.display = 'block';
    inputsList.innerHTML = recipe.inputs
      .map(
        (inp) =>
          `<span class="input-tag ${inp.required ? '' : 'optional'}" title="${inp.required ? 'obrigatório' : 'opcional'}">
            ${escHtml(inp.name)}${inp.required ? '' : ' <span style="opacity:.6">(opcional)</span>'}
          </span>`
      )
      .join('');
  } else {
    inputsSection.style.display = 'none';
    inputsList.innerHTML = '';
  }

  configSection.classList.add('visible');
  configSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Connect ───────────────────────────────────────────────────────────────────

async function connect(): Promise<void> {
  hideFeedback();
  configSection.classList.remove('visible');

  const url = runnerUrl.value.trim().replace(/\/$/, '');
  const key = runnerKey.value.trim();

  if (!url || !key) {
    showFeedback('Preencha a URL do backend e a API Key.', 'error');
    return;
  }

  btnConnect.disabled = true;
  btnConnect.textContent = 'Conectando...';

  try {
    const res = await fetch(`${url}/api/recipes`, {
      headers: { 'X-API-Key': key },
    });

    if (!res.ok) {
      const text = await res.text();
      showFeedback(`Erro ${res.status}: ${text}`, 'error');
      return;
    }

    const recipes = (await res.json()) as Recipe[];
    await chrome.storage.sync.set({ runnerUrl: url, runnerKey: key });
    renderRecipes(recipes);
  } catch (err) {
    showFeedback(`Falha na conexão: ${String(err)}`, 'error');
  } finally {
    btnConnect.disabled = false;
    btnConnect.textContent = 'Conectar';
  }
}

// ── Copy buttons ──────────────────────────────────────────────────────────────

document.querySelectorAll<HTMLButtonElement>('.btn-copy').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const targetId = btn.dataset['target']!;
    const input = document.getElementById(targetId) as HTMLInputElement;
    const toast = document.getElementById(`toast-${targetId}`) as HTMLElement;

    try {
      await navigator.clipboard.writeText(input.value);
    } catch {
      // Fallback
      input.type = 'text';
      input.select();
      document.execCommand('copy');
      if (input.type !== 'text') input.type = input.dataset['originalType'] ?? 'text';
    }

    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1800);
  });
});

btnConnect.addEventListener('click', connect);

// ── Init ─────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  const sync = await chrome.storage.sync.get(['runnerUrl', 'runnerKey']);
  if (sync.runnerUrl) runnerUrl.value = sync.runnerUrl as string;
  if (sync.runnerKey) runnerKey.value = sync.runnerKey as string;

  // Auto-connect if both values are already saved
  if (sync.runnerUrl && sync.runnerKey) {
    await connect();
  }
}

init();
