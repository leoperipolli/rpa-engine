// ─── Step types ───────────────────────────────────────────
export type StepType =
  | 'navigate' | 'click' | 'hover' | 'fill' | 'select'
  | 'wait' | 'extract' | 'screenshot' | 'download' | 'upload'
  | 'pbi_export';

export interface NavigateStep { type: 'navigate'; url: string; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; }
export interface ClickStep { type: 'click'; selector: string; timeout?: number; }
export interface HoverStep { type: 'hover'; selector: string; timeout?: number; }
export interface FillStep { type: 'fill'; selector: string; value: string; clearFirst?: boolean; timeout?: number; }
export interface SelectStep { type: 'select'; selector: string; value: string; timeout?: number; }
export interface WaitStep { type: 'wait'; selector?: string; ms?: number; hidden?: boolean; timeout?: number; }
export interface ExtractStep { type: 'extract'; selector: string; attribute?: string; name: string; multiple?: boolean; timeout?: number; }
export interface ScreenshotStep { type: 'screenshot'; name?: string; fullPage?: boolean; }
export interface DownloadStep { type: 'download'; selector: string; name?: string; timeout?: number; }
export interface UploadStep { type: 'upload'; selector: string; files: string[]; timeout?: number; }
export interface PbiExportStep { type: 'pbi_export'; url: string; body: string; name?: string; timeout?: number; }

export type Step =
  | NavigateStep | ClickStep | HoverStep | FillStep | SelectStep | WaitStep
  | ExtractStep | ScreenshotStep | DownloadStep | UploadStep | PbiExportStep;

// ─── Input / Session / Recipe ─────────────────────────────
export interface InputDefinition {
  name: string;
  required: boolean;
  default?: string;
  description?: string;
  sensitive?: boolean;
}

export interface SessionCheck { selector: string; timeout?: number; }
export interface SessionConfig { check: SessionCheck; login_steps: Step[]; }

export interface Recipe {
  id: string;
  name: string;
  description?: string;
  inputs: InputDefinition[];
  steps: Step[];
  session?: SessionConfig;
  outputs?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

// ─── Execution ────────────────────────────────────────────
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed';

export interface Execution {
  id: string;
  recipe_id: string;
  status: ExecutionStatus;
  inputs: Record<string, string>;
  result?: Record<string, unknown>;
  error?: string;
  duration_ms?: number;
  created_at: string;
  started_at?: string;
  finished_at?: string;
}
