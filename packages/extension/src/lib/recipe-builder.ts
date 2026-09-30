import type { RecordedStep } from '../types.js';

export type StepKind = 'literal' | 'input' | 'secret';

export interface StepConfig {
  kind: StepKind;
  variableName?: string;
}

export interface SessionExportConfig {
  loginFrom: number; // 1-based, inclusive
  loginTo: number;   // 1-based, inclusive
  checkSelector: string;
}

export interface ExportConfig {
  name: string;
  description?: string;
  stepConfigs: Record<number, StepConfig>; // key = 0-based step index
  session?: SessionExportConfig;
}

export interface BackendStep {
  type: string;
  [key: string]: unknown;
}

export interface CreateRecipePayload {
  name: string;
  description?: string;
  inputs: Array<{ name: string; required: boolean }>;
  session?: {
    check: { selector: string };
    login_steps: BackendStep[];
  };
  steps: BackendStep[];
}

function resolveValue(
  value: string,
  stepIndex: number,
  config: ExportConfig
): string {
  const sc = config.stepConfigs[stepIndex];
  if (!sc || sc.kind === 'literal') return value;
  const varName = sc.variableName ?? '';
  if (sc.kind === 'input') return `{{inputs.${varName}}}`;
  return `{{secrets.${varName}}}`;
}

function mapStep(step: RecordedStep, stepIndex: number, config: ExportConfig): BackendStep {
  switch (step.type) {
    case 'navigate':
      return { type: 'navigate', url: step.url };
    case 'click':
      return { type: 'click', selector: step.selector };
    case 'fill':
      return {
        type: 'fill',
        selector: step.selector,
        value: resolveValue(step.value, stepIndex, config),
      };
    case 'select':
      return {
        type: 'select',
        selector: step.selector,
        value: resolveValue(step.value, stepIndex, config),
      };
    case 'extract':
      return {
        type: 'extract',
        name: step.name,
        selector: step.selector,
        multiple: step.multiple,
      };
  }
}

export function buildRecipe(
  steps: RecordedStep[],
  config: ExportConfig
): CreateRecipePayload {
  // Collect unique input variable names
  const inputNames = new Set<string>();
  for (const [idxStr, sc] of Object.entries(config.stepConfigs)) {
    const idx = Number(idxStr);
    if (sc.kind === 'input' && sc.variableName) {
      const step = steps[idx];
      if (step?.type === 'fill' || step?.type === 'select') {
        inputNames.add(sc.variableName);
      }
    }
  }

  const inputs = Array.from(inputNames).map((name) => ({ name, required: true }));

  // Determine login step range (0-based)
  const loginFrom0 = config.session ? config.session.loginFrom - 1 : -1;
  const loginTo0 = config.session ? config.session.loginTo - 1 : -1;

  const isLoginStep = (i: number) =>
    config.session != null && i >= loginFrom0 && i <= loginTo0;

  const mainSteps: BackendStep[] = [];
  const loginSteps: BackendStep[] = [];

  steps.forEach((step, i) => {
    const mapped = mapStep(step, i, config);
    if (isLoginStep(i)) {
      loginSteps.push(mapped);
    } else {
      mainSteps.push(mapped);
    }
  });

  const payload: CreateRecipePayload = {
    name: config.name,
    inputs,
    steps: mainSteps,
  };

  if (config.description) payload.description = config.description;

  if (config.session && loginSteps.length > 0) {
    payload.session = {
      check: { selector: config.session.checkSelector },
      login_steps: loginSteps,
    };
  }

  return payload;
}
