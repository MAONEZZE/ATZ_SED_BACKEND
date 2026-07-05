import { z } from 'zod';

// Sem valores default aqui: toda configuração é a fonte-única do .env. Uma var
// ausente faz o boot falhar (fail-fast) em vez de cair num default escondido.
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_JWT_SECRET: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1),
  SUPABASE_STORAGE_BUCKET_COVERS: z.string().min(1),
  SUPABASE_STORAGE_BUCKET_UPLOADS: z.string().min(1),
  SUPABASE_STORAGE_BUCKET_PROFILE_PHOTOS: z.string().min(1),
  EVOLUTION_API_URL: z.string().url(),
  EVOLUTION_API_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().email(),
  PIPEDRIVE_WEBHOOK_URL: z.string().url(),
  PORT: z.coerce.number().int().positive(),
  BODY_LIMIT: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  ENVIROMENT: z.string().optional(),

  WA_MIN_DELAY_MS: z.coerce.number().int().nonnegative(),
  WA_MAX_DELAY_MS: z.coerce.number().int().nonnegative(),
  WA_AUTOMATION_GAP_MIN_MS: z.coerce.number().int().nonnegative(),
  WA_AUTOMATION_GAP_MAX_MS: z.coerce.number().int().nonnegative(),
  WA_DISPATCH_CONCURRENCY: z.coerce.number().int().positive(),
  WA_TYPING_ENABLED: z
    .union([z.boolean(), z.string()])
    .transform((v) => v !== false && v !== 'false'),
  WA_TYPING_MIN_MS: z.coerce.number().int().nonnegative(),
  WA_TYPING_MAX_MS: z.coerce.number().int().nonnegative(),
  WA_TYPING_MS_PER_CHAR: z.coerce.number().int().nonnegative(),
  WA_TYPING_MAX_TOTAL_MS: z.coerce.number().int().nonnegative(),

  MANUAL_BATCH_SIZE: z.coerce.number().int().positive(),
  MANUAL_BATCH_MIN_DELAY_MS: z.coerce.number().int().nonnegative(),
  MANUAL_BATCH_MAX_DELAY_MS: z.coerce.number().int().nonnegative(),

  SCHEDULED_AUTOMATIONS_INTERVAL_MS: z.coerce.number().int().positive(),
  QUEUE_STALLED_INTERVAL_MS: z.coerce.number().int().positive(),
  REDIS_CLEANUP_CRON: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Environment validation failed:\n${result.error.toString()}`);
  }
  return result.data;
}
