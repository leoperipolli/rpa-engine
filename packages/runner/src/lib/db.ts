import pg from 'pg';
import { z } from 'zod';
import {
  StepSchema,
  SessionConfigSchema,
  InputDefinitionSchema,
  OutputDefinitionSchema,
  type InputDefinition,
  type OutputDefinition,
  type SessionConfig,
  type Step,
} from '@rpa/types';

// ─── Fetched recipe type ──────────────────────────────────────────────────────

export interface FetchedRecipe {
  id: string;
  name: string;
  inputs: InputDefinition[];
  session?: SessionConfig;
  steps: Step[];
  outputs?: OutputDefinition;
  /** AES-256-GCM encrypted JSON: null when recipe has no secrets */
  secrets_encrypted: string | null;
}

// ─── DB query ─────────────────────────────────────────────────────────────────

interface RecipeRow {
  id: string;
  name: string;
  inputs: unknown;
  session: unknown;
  steps: unknown;
  outputs: unknown;
  secrets_encrypted: string | null;
}

/**
 * Fetches a recipe by ID, including the encrypted secrets column.
 * Returns null if not found.
 */
export async function fetchRecipe(
  pool: pg.Pool,
  recipeId: string,
): Promise<FetchedRecipe | null> {
  const { rows } = await pool.query<RecipeRow>(
    `SELECT id, name, inputs, session, steps, outputs, secrets_encrypted
     FROM recipes
     WHERE id = $1`,
    [recipeId],
  );

  if (!rows[0]) return null;
  const row = rows[0];

  return {
    id: row.id,
    name: row.name,
    inputs: z.array(InputDefinitionSchema).parse(row.inputs ?? []),
    session: row.session ? SessionConfigSchema.parse(row.session) : undefined,
    steps: z.array(StepSchema).parse(row.steps),
    outputs: row.outputs ? OutputDefinitionSchema.parse(row.outputs) : undefined,
    secrets_encrypted: row.secrets_encrypted,
  };
}
