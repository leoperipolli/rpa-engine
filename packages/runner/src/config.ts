import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  // Must match the backend's ENCRYPTION_KEY (32 bytes = 64 hex chars)
  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
    .regex(/^[0-9a-fA-F]+$/, 'ENCRYPTION_KEY must be hexadecimal'),

  PLAYWRIGHT_HEADLESS: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(1),
});

const result = ConfigSchema.safeParse(process.env);

if (!result.success) {
  const issues = result.error.issues
    .map((i) => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  console.error(`[config] Invalid environment variables:\n${issues}`);
  process.exit(1);
}

export const config = result.data;
export type Config = z.infer<typeof ConfigSchema>;
