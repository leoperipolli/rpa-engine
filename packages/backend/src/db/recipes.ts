import type { Pool } from 'pg';
import type {
  Recipe,
  CreateRecipeRequest,
  UpdateRecipeRequest,
} from '@rpa/types';
import { encryptSecrets } from '../lib/crypto.js';

// ─── Internal row type (as returned by pg) ────────────────────────────────────

interface RecipeRow {
  id: string;
  name: string;
  description: string | null;
  inputs: unknown;
  session: unknown | null;
  steps: unknown;
  outputs: unknown | null;
  // secrets_encrypted is intentionally excluded from SELECT queries so it
  // never leaks into responses. It is fetched only by the runner (task 1.10).
  created_at: Date;
  updated_at: Date;
}

function toRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    name: row.name,
    ...(row.description != null ? { description: row.description } : {}),
    inputs: (row.inputs ?? []) as Recipe['inputs'],
    ...(row.session != null ? { session: row.session as Recipe['session'] } : {}),
    steps: row.steps as Recipe['steps'],
    ...(row.outputs != null ? { outputs: row.outputs as Recipe['outputs'] } : {}),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

const SELECT_COLS = `
  id, name, description, inputs, session, steps, outputs, created_at, updated_at
`;

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function dbListRecipes(db: Pool): Promise<Recipe[]> {
  const { rows } = await db.query<RecipeRow>(
    `SELECT ${SELECT_COLS} FROM recipes ORDER BY created_at DESC`,
  );
  return rows.map(toRecipe);
}

export async function dbGetRecipe(
  db: Pool,
  id: string,
): Promise<Recipe | null> {
  const { rows } = await db.query<RecipeRow>(
    `SELECT ${SELECT_COLS} FROM recipes WHERE id = $1`,
    [id],
  );
  return rows[0] ? toRecipe(rows[0]) : null;
}

/** Fetch the encrypted secrets blob for use by the runner only. */
export async function dbGetRecipeSecrets(
  db: Pool,
  id: string,
): Promise<string | null> {
  const { rows } = await db.query<{ secrets_encrypted: string | null }>(
    `SELECT secrets_encrypted FROM recipes WHERE id = $1`,
    [id],
  );
  return rows[0]?.secrets_encrypted ?? null;
}

export async function dbCreateRecipe(
  db: Pool,
  data: CreateRecipeRequest,
): Promise<Recipe> {
  const secretsEncrypted = encryptSecrets(data.secrets);

  const { rows } = await db.query<RecipeRow>(
    `INSERT INTO recipes
       (name, description, inputs, session, steps, outputs, secrets_encrypted)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${SELECT_COLS}`,
    [
      data.name,
      data.description ?? null,
      JSON.stringify(data.inputs ?? []),
      data.session ? JSON.stringify(data.session) : null,
      JSON.stringify(data.steps),
      data.outputs ? JSON.stringify(data.outputs) : null,
      secretsEncrypted,
    ],
  );
  return toRecipe(rows[0]);
}

export async function dbUpdateRecipe(
  db: Pool,
  id: string,
  data: UpdateRecipeRequest,
): Promise<Recipe | null> {
  // Build the SET clause dynamically from the provided fields
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const push = (col: string, value: unknown) => {
    setClauses.push(`${col} = $${idx++}`);
    values.push(value);
  };

  if (data.name !== undefined) push('name', data.name);
  if ('description' in data) push('description', data.description ?? null);
  if (data.inputs !== undefined) push('inputs', JSON.stringify(data.inputs));
  if ('session' in data)
    push('session', data.session ? JSON.stringify(data.session) : null);
  if (data.steps !== undefined) push('steps', JSON.stringify(data.steps));
  if ('outputs' in data)
    push('outputs', data.outputs ? JSON.stringify(data.outputs) : null);
  if (data.secrets !== undefined)
    push('secrets_encrypted', encryptSecrets(data.secrets));

  if (setClauses.length === 0) return dbGetRecipe(db, id);

  values.push(id); // last parameter for WHERE id = $N
  const { rows } = await db.query<RecipeRow>(
    `UPDATE recipes SET ${setClauses.join(', ')}
     WHERE id = $${idx}
     RETURNING ${SELECT_COLS}`,
    values,
  );
  return rows[0] ? toRecipe(rows[0]) : null;
}

export async function dbDeleteRecipe(
  db: Pool,
  id: string,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `DELETE FROM recipes WHERE id = $1`,
    [id],
  );
  return (rowCount ?? 0) > 0;
}
