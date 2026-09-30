// ─── BullMQ job payload / result ─────────────────────────────────────────────
// Must stay in sync with the definitions in packages/backend/src/plugins/bullmq.ts

export interface JobData {
  execution_id: string;
  recipe_id: string;
  inputs: Record<string, string>;
}

export interface JobResult {
  result: Record<string, unknown>;
  duration_ms: number;
}
