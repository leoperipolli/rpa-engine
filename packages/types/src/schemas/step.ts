import { z } from 'zod';

// ─── Individual step schemas ────────────────────────────────────────────────

const NavigateStep = z.object({
  type: z.literal('navigate'),
  /** URL to navigate to. Supports interpolation: {{inputs.url}} */
  url: z.string().min(1),
  /** Wait until this network state before continuing */
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
});

const ClickStep = z.object({
  type: z.literal('click'),
  /** CSS selector or XPath of the element to click */
  selector: z.string().min(1),
  /** Milliseconds to wait for selector before failing */
  timeout: z.number().int().positive().optional(),
  /** If true, failures are silently ignored (step is skipped) */
  optional: z.boolean().optional(),
});

const HoverStep = z.object({
  type: z.literal('hover'),
  /** CSS selector of the element to hover over */
  selector: z.string().min(1),
  /** Milliseconds to wait for selector before failing */
  timeout: z.number().int().positive().optional(),
  /** If true, failures are silently ignored (step is skipped) */
  optional: z.boolean().optional(),
});

const FillStep = z.object({
  type: z.literal('fill'),
  /** CSS selector of the input element */
  selector: z.string().min(1),
  /** Value to type. Supports interpolation: {{inputs.campo}}, {{secrets.senha}} */
  value: z.string(),
  /** Clear existing content before filling */
  clearFirst: z.boolean().optional(),
  /** Type character by character (fires keydown/keypress/keyup). Use for ASP.NET/legacy controls */
  typeMode: z.boolean().optional(),
  timeout: z.number().int().positive().optional(),
  /** If true, failures are silently ignored (step is skipped) */
  optional: z.boolean().optional(),
});

const SelectStep = z.object({
  type: z.literal('select'),
  /** CSS selector of the <select> element */
  selector: z.string().min(1),
  /** Option value to select. Supports interpolation */
  value: z.string(),
  timeout: z.number().int().positive().optional(),
  /** If true, failures are silently ignored (step is skipped) */
  optional: z.boolean().optional(),
});

// Note: z.discriminatedUnion requires plain ZodObject (no ZodEffects),
// so the cross-field rule (selector OR ms required) is enforced at runtime
// inside the runner and in the API layer, not here.
const WaitStep = z.object({
  type: z.literal('wait'),
  /** Wait for this selector to appear in the DOM */
  selector: z.string().min(1).optional(),
  /** Wait a fixed number of milliseconds */
  ms: z.number().int().positive().optional(),
  /** Wait until selector disappears (e.g. loading spinner) */
  hidden: z.boolean().optional(),
  timeout: z.number().int().positive().optional(),
});

const ExtractStep = z.object({
  type: z.literal('extract'),
  /** CSS selector to extract data from */
  selector: z.string().min(1),
  /** HTML attribute to read. Omit to use text content */
  attribute: z.string().optional(),
  /** Key name used in the execution result */
  name: z.string().min(1),
  /** Extract all matches instead of just the first */
  multiple: z.boolean().optional(),
  timeout: z.number().int().positive().optional(),
});

const ScreenshotStep = z.object({
  type: z.literal('screenshot'),
  /** Key name stored in the execution result (defaults to "screenshot") */
  name: z.string().optional(),
  /** Capture the full scrollable page */
  fullPage: z.boolean().optional(),
});

const DownloadStep = z.object({
  type: z.literal('download'),
  /** CSS selector of the element that triggers the download */
  selector: z.string().min(1),
  /** Key name stored in the execution result (defaults to "download") */
  name: z.string().optional(),
  timeout: z.number().int().positive().optional(),
});

const UploadStep = z.object({
  type: z.literal('upload'),
  /** CSS selector of the file input element */
  selector: z.string().min(1),
  /**
   * File paths on the runner machine, or base64-encoded file contents
   * prefixed with "base64:". Supports interpolation.
   */
  files: z.array(z.string().min(1)).min(1),
  timeout: z.number().int().positive().optional(),
});

const PbiExportStep = z.object({
  type: z.literal('pbi_export'),
  /** Power BI export API endpoint URL */
  url: z.string().min(1),
  /** JSON body with the semantic query */
  body: z.string().min(1),
  /** Key name stored in the execution result (defaults to "pbi_export") */
  name: z.string().optional(),
  timeout: z.number().int().positive().optional(),
});

// ─── Discriminated union ─────────────────────────────────────────────────────

export const StepSchema = z.discriminatedUnion('type', [
  NavigateStep,
  ClickStep,
  HoverStep,
  FillStep,
  SelectStep,
  WaitStep,
  ExtractStep,
  ScreenshotStep,
  DownloadStep,
  UploadStep,
  PbiExportStep,
]);

export type Step = z.infer<typeof StepSchema>;

// Convenience re-exports for individual step types
export type NavigateStep = z.infer<typeof NavigateStep>;
export type ClickStep = z.infer<typeof ClickStep>;
export type HoverStep = z.infer<typeof HoverStep>;
export type FillStep = z.infer<typeof FillStep>;
export type SelectStep = z.infer<typeof SelectStep>;
export type WaitStep = z.infer<typeof WaitStep>;
export type ExtractStep = z.infer<typeof ExtractStep>;
export type ScreenshotStep = z.infer<typeof ScreenshotStep>;
export type DownloadStep = z.infer<typeof DownloadStep>;
export type UploadStep = z.infer<typeof UploadStep>;
export type PbiExportStep = z.infer<typeof PbiExportStep>;
