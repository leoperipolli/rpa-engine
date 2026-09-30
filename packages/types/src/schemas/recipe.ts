import { z } from 'zod';
import { StepSchema } from './step.js';
import { SessionConfigSchema } from './session.js';

// ─── Input definition ────────────────────────────────────────────────────────

/**
 * Declares a dynamic input variable for a recipe.
 * At execution time, values are passed via CreateExecutionRequest.inputs.
 */
export const InputDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean().default(true),
  /** Default value used when the caller omits this input */
  default: z.string().optional(),
});

// ─── Output definition ───────────────────────────────────────────────────────

/**
 * Maps a human-readable key to the `name` of an ExtractStep (or ScreenshotStep).
 * E.g. { "tracking_status": "status" } pulls the "status" extract into the result.
 */
export const OutputDefinitionSchema = z.record(z.string().min(1), z.string().min(1));

// ─── Recipe ──────────────────────────────────────────────────────────────────

export const RecipeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  /** Human-readable description of what this recipe does */
  description: z.string().optional(),
  /**
   * Input variable declarations.
   * At runtime, values are resolved from the execution request.
   */
  inputs: z.array(InputDefinitionSchema).default([]),
  /**
   * Optional session config for systems that require login.
   * Enables automatic re-login when session expires.
   */
  session: SessionConfigSchema.optional(),
  /** Ordered list of automation steps to execute */
  steps: z.array(StepSchema).min(1),
  /**
   * Maps result keys to extract step names.
   * Omit to include all extracted values in the result.
   */
  outputs: OutputDefinitionSchema.optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type InputDefinition = z.infer<typeof InputDefinitionSchema>;
export type OutputDefinition = z.infer<typeof OutputDefinitionSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;
