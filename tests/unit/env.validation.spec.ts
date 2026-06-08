import { validateEnv } from '@api/config/env.validation';

describe('validateEnv', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://sed:sed@localhost:5432/sed',
    DIRECT_URL: 'postgresql://sed:sed@localhost:5432/sed',
    REDIS_URL: 'redis://localhost:6379',
    SUPABASE_URL: 'https://xxx.supabase.co',
    SUPABASE_JWT_SECRET: 'secret',
    SUPABASE_SERVICE_ROLE_KEY: 'key',
    EVOLUTION_API_URL: 'https://evolution.example.com',
    EVOLUTION_API_KEY: 'key',
    RESEND_API_KEY: 're_xxx',
    RESEND_FROM_EMAIL: 'no-reply@example.com',
    GEMINI_API_KEY: 'AIza',
    PORT: '3000',
    NODE_ENV: 'test',
  };

  it('passes with all required vars', () => {
    expect(() => validateEnv(validEnv)).not.toThrow();
  });

  it('throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _, ...rest } = validEnv;
    expect(() => validateEnv(rest)).toThrow('Environment validation failed');
  });

  it('applies defaults for PORT and NODE_ENV', () => {
    const { PORT: _, NODE_ENV: __, ...rest } = validEnv;
    const result = validateEnv(rest);
    expect(result.PORT).toBe(3000);
    expect(result.NODE_ENV).toBe('development');
  });

  it('applies WhatsApp anti-ban pacing defaults', () => {
    const result = validateEnv(validEnv);
    expect(result.WA_MIN_DELAY_MS).toBe(8000);
    expect(result.WA_MAX_DELAY_MS).toBe(30000);
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
