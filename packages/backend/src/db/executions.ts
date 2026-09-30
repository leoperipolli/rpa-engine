import type { Pool } from 'pg';
import type { Execution, ListExecutionsQuery } from '@rpa/types';

// ─── Internal row type ────────────────────────────────────────────────────────

interface ExecutionRow {
  id: string;
  recipe_id: string;
  status: Execution['status'];
  inputs: unknown;
  result: unknown | null;
  error: string | null;
  duration_ms: number | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
}

function toExecution(row: ExecutionRow): Execution {
  return {
    id: row.id,
    recipe_id: row.recipe_id,
    status: row.status,
    inputs: (row.inputs ?? {}) as Record<string, string>,
    ...(row.result != null ? { result: row.result as Record<string, unknown> } : {}),
    ...(row.error != null ? { error: row.error } : {}),
    ...(row.duration_ms != null ? { duration_ms: row.duration_ms } : {}),
    created_at: row.created_at.toISOString(),
    ...(row.started_at != null ? { started_at: row.started_at.toISOString() } : {}),
    ...(row.finished_at != null ? { finished_at: row.finished_at.toISOString() } : {}),
  };
}

const SELECT_COLS = `
  id, recipe_id, status, inputs, result, error,
  duration_ms, created_at, started_at, finished_at
`;

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function dbCreateExecution(
  db: Pool,
  data: { recipe_id: string; inputs: Record<string, string> },
): Promise<Execution> {
  const { rows } = await db.query<ExecutionRow>(
    `INSERT INTO executions (recipe_id, inputs)
     VALUES ($1, $2)
     RETURNING ${SELECT_COLS}`,
    [data.recipe_id, JSON.stringify(data.inputs)],
  );
  return toExecution(rows[0]);
}

export async function dbGetExecution(
  db: Pool,
  id: string,
): Promise<Execution | null> {
  const { rows } = await db.query<ExecutionRow>(
    `SELECT ${SELECT_COLS} FROM executions WHERE id = $1`,
    [id],
  );
  return rows[0] ? toExecution(rows[0]) : null;
}

export interface ExecutionListResult {
  executions: Execution[];
  total: number;
  page: number;
  limit: number;
}

export async function dbListExecutions(
  db: Pool,
  query: ListExecutionsQuery,
): Promise<ExecutionListResult> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (query.recipe_id) {
    conditions.push(`recipe_id = $${idx++}`);
    values.push(query.recipe_id);
  }
  if (query.status) {
    conditions.push(`status = $${idx++}`);
    values.push(query.status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (query.page - 1) * query.limit;

  const [{ rows }, countRes] = await Promise.all([
    db.query<ExecutionRow>(
      `SELECT ${SELECT_COLS} FROM executions
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, query.limit, offset],
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM executions ${where}`,
      values,
    ),
  ]);

  return {
    executions: rows.map(toExecution),
    total: parseInt(countRes.rows[0].count, 10),
    page: query.page,
    limit: query.limit,
  };
}

// ─── Status transitions (called by BullMQ event handlers) ────────────────────

export async function dbStartExecution(db: Pool, id: string): Promise<void> {
  await db.query(
    `UPDATE executions
     SET status = 'running', started_at = NOW()
     WHERE id = $1 AND status = 'pending'`,
    [id],
  );
}

export async function dbCompleteExecution(
  db: Pool,
  id: string,
  result: Record<string, unknown>,
  duration_ms: number,
): Promise<void> {
  await db.query(
    `UPDATE executions
     SET status = 'success',
         result = $2,
         duration_ms = $3,
         finished_at = NOW()
     WHERE id = $1`,
    [id, JSON.stringify(result), duration_ms],
  );
}

export async function dbFailExecution(
  db: Pool,
  id: string,
  error: string,
  duration_ms?: number,
): Promise<void> {
  await db.query(
    `UPDATE executions
     SET status = 'failed',
         error = $2,
         duration_ms = $3,
         finished_at = NOW()
     WHERE id = $1`,
    [id, error, duration_ms ?? null],
  );
}
