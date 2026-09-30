import { z } from 'zod';
import { StepSchema } from './step.js';

export const SessionCheckSchema = z.object({
  /**
   * CSS selector that is present only when the user is logged in.
   * The runner checks for this element; if absent, it runs login_steps.
   * Mutually exclusive with `js`.
   */
  selector: z.string().min(1).optional(),
  /**
   * JavaScript expression evaluated in the browser context.
   * Must return a truthy value when the session is active.
   * Useful for checking sessionStorage/localStorage state (e.g. MSAL tokens).
   * Mutually exclusive with `selector`.
   */
  js: z.string().min(1).optional(),
  /** Milliseconds to wait for the selector before concluding session is expired */
  timeout: z.number().int().positive().optional(),
}).refine(data => !!(data.selector || data.js), {
  message: 'session.check must have either selector or js',
});

export const HttpCredentialsSchema = z.object({
  /** Username for HTTP Basic Auth. Supports {{secrets.*}} interpolation. */
  username: z.string().min(1),
  /** Password for HTTP Basic Auth. Supports {{secrets.*}} interpolation. */
  password: z.string().min(1),
});

export const SessionConfigSchema = z.object({
  /** How to detect whether the session is still active */
  check: SessionCheckSchema,
  /**
   * Steps to execute when session is expired.
   * Typically: navigate to login page, fill credentials, click submit, wait for dashboard.
   * Supports {{secrets.*}} interpolation for credentials.
   */
  login_steps: z.array(StepSchema).min(1),
  /**
   * HTTP Basic Auth credentials.
   * Applied to the browser context so native auth dialogs are handled automatically.
   * Supports {{secrets.*}} interpolation.
   */
  http_credentials: HttpCredentialsSchema.optional(),
});

export type HttpCredentials = z.infer<typeof HttpCredentialsSchema>;
export type SessionCheck = z.infer<typeof SessionCheckSchema>;
export type SessionConfig = z.infer<typeof SessionConfigSchema>;
