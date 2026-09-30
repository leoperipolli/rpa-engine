import type { Step, StepType } from './types';

export const STEP_TYPE_LABELS: Record<StepType, string> = {
  navigate: 'Navegar',
  click: 'Clicar',
  hover: 'Hover',
  fill: 'Preencher',
  select: 'Selecionar',
  wait: 'Aguardar',
  extract: 'Extrair dados',
  screenshot: 'Captura de tela',
  download: 'Download',
  upload: 'Upload',
  pbi_export: 'PBI Export',
};

export const STEP_TYPE_DESCRIPTIONS: Record<StepType, string> = {
  navigate: 'Acessar uma URL',
  click: 'Clicar em um elemento',
  hover: 'Passar o mouse sobre um elemento',
  fill: 'Preencher um campo de texto',
  select: 'Selecionar opção em dropdown',
  wait: 'Aguardar elemento ou tempo',
  extract: 'Extrair dados da página',
  screenshot: 'Capturar tela',
  download: 'Baixar arquivo',
  upload: 'Enviar arquivo',
  pbi_export: 'Exportar dados do Power BI via API',
};

export const ALL_STEP_TYPES: StepType[] = [
  'navigate', 'click', 'hover', 'fill', 'select', 'wait',
  'extract', 'screenshot', 'download', 'upload', 'pbi_export',
];

export function createDefaultStep(type: StepType): Step {
  switch (type) {
    case 'navigate': return { type: 'navigate', url: '' };
    case 'click': return { type: 'click', selector: '' };
    case 'hover': return { type: 'hover', selector: '' };
    case 'fill': return { type: 'fill', selector: '', value: '' };
    case 'select': return { type: 'select', selector: '', value: '' };
    case 'wait': return { type: 'wait' };
    case 'extract': return { type: 'extract', selector: '', name: '' };
    case 'screenshot': return { type: 'screenshot' };
    case 'download': return { type: 'download', selector: '' };
    case 'upload': return { type: 'upload', selector: '', files: [] };
    case 'pbi_export': return { type: 'pbi_export', url: '', body: '' };
  }
}

/** Fields shared between step types that should be preserved when changing type */
const SELECTOR_TYPES: StepType[] = ['click', 'hover', 'fill', 'select', 'wait', 'extract', 'download', 'upload'];
const TIMEOUT_TYPES: StepType[] = ['click', 'hover', 'fill', 'select', 'wait', 'extract', 'download', 'upload', 'pbi_export'];

export function changeStepType(existing: Step, newType: StepType): Step {
  const base = createDefaultStep(newType);

  // Preserve selector if both old and new types use it
  if (
    SELECTOR_TYPES.includes(existing.type) &&
    SELECTOR_TYPES.includes(newType) &&
    'selector' in existing && existing.selector &&
    'selector' in base
  ) {
    (base as { selector: string }).selector = existing.selector;
  }

  // Preserve timeout if both types use it
  if (
    TIMEOUT_TYPES.includes(existing.type) &&
    TIMEOUT_TYPES.includes(newType) &&
    'timeout' in existing && existing.timeout &&
    'timeout' in base
  ) {
    (base as { timeout?: number }).timeout = existing.timeout;
  }

  return base;
}

/** Get a short preview string for the step card header */
export function getStepPreview(step: Step): string {
  switch (step.type) {
    case 'navigate': return step.url || '(sem URL)';
    case 'click': return step.selector || '(sem seletor)';
    case 'hover': return step.selector || '(sem seletor)';
    case 'fill': return step.selector ? `${step.selector} = ${step.value || '...'}` : '(sem seletor)';
    case 'select': return step.selector ? `${step.selector} = ${step.value || '...'}` : '(sem seletor)';
    case 'wait': return step.selector || (step.ms ? `${step.ms}ms` : '(sem config)');
    case 'extract': return step.name ? `${step.name} ← ${step.selector || '...'}` : step.selector || '(sem config)';
    case 'screenshot': return step.name || 'screenshot';
    case 'download': return step.selector || '(sem seletor)';
    case 'upload': return step.selector || '(sem seletor)';
    case 'pbi_export': return step.url ? step.url.substring(0, 50) + (step.url.length > 50 ? '...' : '') : '(sem URL)';
  }
}
