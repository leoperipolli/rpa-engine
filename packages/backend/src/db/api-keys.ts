import type { Pool } from 'pg';
import { createHash } from 'crypto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

// ─── Row / domain types ───────────────────────────────────────────────────────

interface ApiKeyRow {
  id: string;
  name: string;
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
}

export interface ApiKey {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

function toApiKey(row: ApiKeyRow): ApiKey {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at.toISOString(),
    last_used_at: row.last_used_at?.toISOString() ?? null,
    revoked_at: row.revoked_at?.toISOString() ?? null,
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function dbCreateApiKey(
  db: Pool,
  name: string,
  keyHash: string,
): Promise<ApiKey> {
  const { rows } = await db.query<ApiKeyRow>(
    `INSERT INTO api_keys (name, key_hash)
     VALUES ($1, $2)
     RETURNING id, name, created_at, last_used_at, revoked_at`,
    [name, keyHash],
  );
  return toApiKey(rows[0]);
}

export async function dbFindApiKeyByHash(
  db: Pool,
  keyHash: string,
): Promise<ApiKey | null> {
  const { rows } = await db.query<ApiKeyRow>(
    `SELECT id, name, created_at, last_used_at, revoked_at
     FROM api_keys
     WHERE key_hash = $1 AND revoked_at IS NULL`,
    [keyHash],
  );
  return rows[0] ? toApiKey(rows[0]) : null;
}

export async function dbUpdateApiKeyLastUsed(
  db: Pool,
  id: string,
): Promise<void> {
  await db.query(
    `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
    [id],
  );
}
