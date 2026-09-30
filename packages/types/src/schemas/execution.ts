import { z } from 'zod';

export const ExecutionStatusSchema = z.enum(['pending', 'running', 'success', 'failed']);

export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

export const ExecutionSchema = z.object({
  id: z.string().uuid(),
  recipe_id: z.string().uuid(),
  status: ExecutionStatusSchema,
  /** Input values provided by the caller at execution time */
  inputs: z.record(z.string(), z.string()),
  /**
   * Extracted data and screenshots produced by the run.
   * Only present when status is "success".
   */
  result: z.record(z.string(), z.unknown()).optional(),
  /**
   * Human-readable error message.
   * Only present when status is "failed".
   */
  error: z.string().optional(),
  /** Total wall-clock time in milliseconds */
  duration_ms: z.number().int().nonnegative().optional(),
  created_at: z.string().datetime(),
  started_at: z.string().datetime().optional(),
  finished_at: z.string().datetime().optional(),
});

export type Execution = z.infer<typeof ExecutionSchema>;
