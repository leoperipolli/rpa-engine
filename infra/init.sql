-- =============================================================================
-- RPA — initial schema
-- Runs automatically on first `docker compose up` (postgres init hook)
-- =============================================================================

-- Enable uuid_generate_v4() — pgcrypto's gen_random_uuid() is built-in on PG 13+
-- so we rely on gen_random_uuid() instead.

-- =============================================================================
-- TABLE: recipes
-- =============================================================================
CREATE TABLE IF NOT EXISTS recipes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  description      TEXT,

  -- Array of InputDefinition objects (declared dynamic variables)
  inputs           JSONB       NOT NULL DEFAULT '[]'::jsonb,

  -- SessionConfig: { check: { selector }, login_steps: Step[] } or null
  session          JSONB,

  -- Ordered array of Step objects
  steps            JSONB       NOT NULL,

  -- OutputDefinition: { resultKey: extractStepName } or null
  outputs          JSONB,

  -- AES-256-GCM encrypted JSON of { secretKey: plaintext }.
  -- Format: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
  secrets_encrypted TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- =============================================================================
-- TABLE: executions
-- =============================================================================
CREATE TABLE IF NOT EXISTS executions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id    UUID        NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,

  -- pending → running → success | failed
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'running', 'success', 'failed')),

  -- Runtime input values provided by the caller: { inputName: value }
  inputs       JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- Extracted data produced by the run (present when status = 'success')
  result       JSONB,

  -- Human-readable error message (present when status = 'failed')
  error        TEXT,

  -- Total wall-clock time in milliseconds
  duration_ms  INTEGER,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ
);

-- =============================================================================
-- INDICES
-- =============================================================================

-- Recipes
CREATE INDEX IF NOT EXISTS idx_recipes_name
  ON recipes (name);

CREATE INDEX IF NOT EXISTS idx_recipes_created_at
  ON recipes (created_at DESC);

-- Executions — primary access patterns:
--   • GET /api/executions?recipe_id=...
--   • GET /api/executions?status=...
--   • GET /api/executions/:id  (already covered by PK)
--   • ORDER BY created_at DESC for history

CREATE INDEX IF NOT EXISTS idx_executions_recipe_id
  ON executions (recipe_id);

CREATE INDEX IF NOT EXISTS idx_executions_status
  ON executions (status);

CREATE INDEX IF NOT EXISTS idx_executions_created_at
  ON executions (created_at DESC);

-- Composite: most common combined filter (recipe_id + status)
CREATE INDEX IF NOT EXISTS idx_executions_recipe_status
  ON executions (recipe_id, status);

-- =============================================================================
-- TABLE: api_keys
-- =============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(255) NOT NULL,

  -- SHA-256 hash of the raw key — plaintext is never stored
  key_hash     TEXT        NOT NULL UNIQUE,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,

  -- NULL = active; set to revoke
  revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash
  ON api_keys (key_hash);

-- =============================================================================
-- DONE
-- =============================================================================
