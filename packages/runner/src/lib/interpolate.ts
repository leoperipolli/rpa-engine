// ─── Execution context ────────────────────────────────────────────────────────

export interface ExecutionContext {
  /** Runtime input values supplied by the caller: { inputName: value } */
  inputs: Record<string, string>;
  /** Plaintext secrets decrypted from the recipe: { secretName: value } */
  secrets: Record<string, string>;
}

// ─── Interpolation ────────────────────────────────────────────────────────────

const RE = /\{\{(inputs|secrets)\.([^}]+)\}\}/g;

/**
 * Replaces `{{inputs.X}}` and `{{secrets.X}}` placeholders with values from
 * the execution context. Missing variables resolve to an empty string.
 */
export function interpolate(template: string, ctx: ExecutionContext): string {
  return template.replace(RE, (_match, ns: string, key: string) => {
    const value = ns === 'inputs' ? ctx.inputs[key] : ctx.secrets[key];
    return value ?? '';
  });
}
