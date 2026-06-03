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
});
