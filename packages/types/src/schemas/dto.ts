import { z } from 'zod';
import { StepSchema } from './step.js';
import { SessionConfigSchema } from './session.js';
import { InputDefinitionSchema, OutputDefinitionSchema } from './recipe.js';

// ─── Recipe DTOs ─────────────────────────────────────────────────────────────

export const CreateRecipeRequestSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  inputs: z.array(InputDefinitionSchema).default([]),
  session: SessionConfigSchema.optional(),
  steps: z.array(StepSchema).min(1),
  outputs: OutputDefinitionSchema.optional(),
  /**
   * Plaintext secret values: { secretName: "value" }.
   * Stored AES-256-GCM encrypted in the DB; never returned in API responses.
   * Referenced in steps/session via {{secrets.secretName}}.
   */
  secrets: z.record(z.string().min(1), z.string()).optional(),
});

export const UpdateRecipeRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  inputs: z.array(InputDefinitionSchema).optional(),
  session: SessionConfigSchema.optional(),
  steps: z.array(StepSchema).min(1).optional(),
  outputs: OutputDefinitionSchema.optional(),
  secrets: z.record(z.string().min(1), z.string()).optional(),
}).refine(
  (body) => Object.keys(body).length > 0,
  { message: 'At least one field must be provided for update' },
);

// ─── Execution DTOs ──────────────────────────────────────────────────────────

export const CreateExecutionRequestSchema = z.object({
  recipe_id: z.string().uuid(),
  /** Runtime values for the recipe's declared inputs */
  inputs: z.record(z.string(), z.string()).default({}),
});

// ─── Query parameter schemas ─────────────────────────────────────────────────

export const ListExecutionsQuerySchema = z.object({
  recipe_id: z.string().uuid().optional(),
  status: z.enum(['pending', 'running', 'success', 'failed']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type CreateRecipeRequest = z.infer<typeof CreateRecipeRequestSchema>;
export type UpdateRecipeRequest = z.infer<typeof UpdateRecipeRequestSchema>;
export type CreateExecutionRequest = z.infer<typeof CreateExecutionRequestSchema>;
export type ListExecutionsQuery = z.infer<typeof ListExecutionsQuerySchema>;
