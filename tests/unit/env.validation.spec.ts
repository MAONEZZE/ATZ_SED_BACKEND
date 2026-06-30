import { validateEnv } from '@api/config/env.validation';

describe('validateEnv', () => {
  // .env é a fonte-única: o schema não tem defaults, então todas precisam estar presentes.
  const validEnv = {
    DATABASE_URL: 'postgresql://sed:sed@localhost:5432/sed',
    DIRECT_URL: 'postgresql://sed:sed@localhost:5432/sed',
    REDIS_URL: 'redis://localhost:6379',
    SUPABASE_URL: 'https://xxx.supabase.co',
    SUPABASE_JWT_SECRET: 'secret',
    SUPABASE_SERVICE_ROLE_KEY: 'key',
    SUPABASE_STORAGE_BUCKET: 'ATZ_SED',
    SUPABASE_STORAGE_BUCKET_COVERS: 'event-covers',
    SUPABASE_STORAGE_BUCKET_UPLOADS: 'registration-uploads',
    SUPABASE_STORAGE_BUCKET_PROFILE_PHOTOS: 'profile-photo',
    EVOLUTION_API_URL: 'https://evolution.example.com',
    EVOLUTION_API_KEY: 'key',
    RESEND_API_KEY: 're_xxx',
    RESEND_FROM_EMAIL: 'no-reply@example.com',
    PIPEDRIVE_WEBHOOK_URL: 'https://n8n.example.com/webhook/x',
    PORT: '3000',
    NODE_ENV: 'test',
    ENVIROMENT: 'dev',
    WA_MIN_DELAY_MS: '8000',
    WA_MAX_DELAY_MS: '30000',
    WA_AUTOMATION_GAP_MIN_MS: '40000',
    WA_AUTOMATION_GAP_MAX_MS: '60000',
    WA_DISPATCH_CONCURRENCY: '1',
    WA_TYPING_ENABLED: 'true',
    WA_TYPING_MIN_MS: '1500',
    WA_TYPING_MAX_MS: '4000',
    WA_TYPING_MS_PER_CHAR: '40',
    WA_TYPING_MAX_TOTAL_MS: '15000',
    MANUAL_BATCH_SIZE: '10',
    MANUAL_BATCH_MIN_DELAY_MS: '3600000',
    MANUAL_BATCH_MAX_DELAY_MS: '7200000',
    SCHEDULED_AUTOMATIONS_INTERVAL_MS: '120000',
    QUEUE_STALLED_INTERVAL_MS: '600000',
    REDIS_CLEANUP_CRON: '0 4 * * *',
  };

  it('passes with all required vars', () => {
    expect(() => validateEnv(validEnv)).not.toThrow();
  });

  it('throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _, ...rest } = validEnv;
    expect(() => validateEnv(rest)).toThrow('Environment validation failed');
  });

  it('throws when a config var is missing (no hidden defaults)', () => {
    const { WA_AUTOMATION_GAP_MIN_MS: _, ...rest } = validEnv;
    expect(() => validateEnv(rest)).toThrow('Environment validation failed');
    const { PORT: __, ...rest2 } = validEnv;
    expect(() => validateEnv(rest2)).toThrow('Environment validation failed');
  });

  it('reads PORT and NODE_ENV from env (coerced)', () => {
    const result = validateEnv(validEnv);
    expect(result.PORT).toBe(3000);
    expect(result.NODE_ENV).toBe('test');
  });

  it('reads WhatsApp anti-ban pacing values from env', () => {
    const result = validateEnv(validEnv);
    expect(result.WA_MIN_DELAY_MS).toBe(8000);
    expect(result.WA_MAX_DELAY_MS).toBe(30000);
    expect(result.WA_AUTOMATION_GAP_MIN_MS).toBe(40000);
    expect(result.WA_AUTOMATION_GAP_MAX_MS).toBe(60000);
    expect(result.WA_DISPATCH_CONCURRENCY).toBe(1);
    expect(result.WA_TYPING_ENABLED).toBe(true);
    expect(result.WA_TYPING_MIN_MS).toBe(1500);
    expect(result.WA_TYPING_MAX_MS).toBe(4000);
    expect(result.WA_TYPING_MS_PER_CHAR).toBe(40);
    expect(result.WA_TYPING_MAX_TOTAL_MS).toBe(15000);
  });

  it('coerces WA pacing env strings to numbers', () => {
    const result = validateEnv({ ...validEnv, WA_MIN_DELAY_MS: '5000', WA_MAX_DELAY_MS: '20000' });
    expect(result.WA_MIN_DELAY_MS).toBe(5000);
    expect(result.WA_MAX_DELAY_MS).toBe(20000);
  });

  it('parses WA_TYPING_ENABLED="false" as boolean false', () => {
    const result = validateEnv({ ...validEnv, WA_TYPING_ENABLED: 'false' });
    expect(result.WA_TYPING_ENABLED).toBe(false);
  });
});
