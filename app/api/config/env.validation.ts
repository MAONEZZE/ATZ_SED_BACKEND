import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_JWT_SECRET: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().default('ATZ_SED'),
  SUPABASE_STORAGE_BUCKET_COVERS: z.string().default('event-covers'),
  SUPABASE_STORAGE_BUCKET_UPLOADS: z.string().default('registration-uploads'),
  SUPABASE_STORAGE_BUCKET_PROFILE_PHOTOS: z.string().default('profile-photo'),
  EVOLUTION_API_URL: z.string().url(),
  EVOLUTION_API_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().email(),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ENVIROMENT: z.string().optional(),

  WA_MIN_DELAY_MS: z.coerce.number().int().nonnegative().default(8000),
  WA_MAX_DELAY_MS: z.coerce.number().int().nonnegative().default(30000),
  WA_DISPATCH_CONCURRENCY: z.coerce.number().int().positive().default(1),
  WA_TYPING_ENABLED: z
    .union([z.boolean(), z.string()])
    .default(true)
    .transform((v) => v !== false && v !== 'false'),
  WA_TYPING_MIN_MS: z.coerce.number().int().nonnegative().default(1500),
  WA_TYPING_MAX_MS: z.coerce.number().int().nonnegative().default(4000),
  WA_TYPING_MS_PER_CHAR: z.coerce.number().int().nonnegative().default(40),
  WA_TYPING_MAX_TOTAL_MS: z.coerce.number().int().nonnegative().default(15000),

  MANUAL_BATCH_SIZE: z.coerce.number().int().positive().default(10),
  MANUAL_BATCH_MIN_DELAY_MS: z.coerce.number().int().nonnegative().default(3_600_000),
  MANUAL_BATCH_MAX_DELAY_MS: z.coerce.number().int().nonnegative().default(7_200_000),

  SCHEDULED_AUTOMATIONS_INTERVAL_MS: z.coerce.number().int().positive().default(120_000),
  QUEUE_STALLED_INTERVAL_MS: z.coerce.number().int().positive().default(600_000),
  REDIS_CLEANUP_CRON: z.string().default('0 4 * * *'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Environment validation failed:\n${result.error.toString()}`);
  }
  return result.data;
}
