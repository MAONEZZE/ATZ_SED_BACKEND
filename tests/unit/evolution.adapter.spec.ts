import { EvolutionAdapter } from '@database/integrations/evolution.adapter';

function makeConfig(over: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    EVOLUTION_API_URL: 'https://evo.example.com',
    EVOLUTION_API_KEY: 'key-123',
    WA_TYPING_ENABLED: true,
    WA_TYPING_MIN_MS: 2000,
    WA_TYPING_MAX_MS: 2000, // min===max → determinístico
    WA_TYPING_MS_PER_CHAR: 0,
    WA_TYPING_MAX_TOTAL_MS: 15000,
    ...over,
  };
  return { get: jest.fn((k: string) => base[k]) };
}

function mockFetchOk() {
  const fn = jest.fn().mockResolvedValue({ ok: true, text: jest.fn() });
  (global as any).fetch = fn;
  return fn;
}

function lastBody(fetchFn: jest.Mock) {
  return JSON.parse(fetchFn.mock.calls[0][1].body);
}

describe('EvolutionAdapter.sendWhatsApp', () => {
  beforeEach(() => jest.clearAllMocks());

  it('inclui delay de digitação no payload quando typing habilitado', async () => {
    const fetchFn = mockFetchOk();
    const adapter = new EvolutionAdapter(makeConfig() as any);
    await adapter.sendWhatsApp('inst-1', '+5511999999999', 'oi');
    expect(lastBody(fetchFn).delay).toBe(2000);
  });

  it('soma tempo proporcional ao tamanho do texto', async () => {
    const fetchFn = mockFetchOk();
    const adapter = new EvolutionAdapter(makeConfig({ WA_TYPING_MS_PER_CHAR: 10 }) as any);
    await adapter.sendWhatsApp('inst-1', '+5511999999999', 'abcde'); // 5 chars
    expect(lastBody(fetchFn).delay).toBe(2000 + 5 * 10);
  });

  it('respeita o teto WA_TYPING_MAX_TOTAL_MS', async () => {
    const fetchFn = mockFetchOk();
    const adapter = new EvolutionAdapter(
      makeConfig({ WA_TYPING_MIN_MS: 5000, WA_TYPING_MAX_MS: 5000, WA_TYPING_MAX_TOTAL_MS: 3000 }) as any,
    );
    await adapter.sendWhatsApp('inst-1', '+5511999999999', 'oi');
    expect(lastBody(fetchFn).delay).toBe(3000);
  });

  it('não inclui delay quando typing desabilitado', async () => {
    const fetchFn = mockFetchOk();
    const adapter = new EvolutionAdapter(makeConfig({ WA_TYPING_ENABLED: false }) as any);
    await adapter.sendWhatsApp('inst-1', '+5511999999999', 'oi');
    expect(lastBody(fetchFn).delay).toBeUndefined();
  });

  it('lança em resposta não-ok', async () => {
    const fn = jest.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'bad' });
    (global as any).fetch = fn;
    const adapter = new EvolutionAdapter(makeConfig() as any);
    await expect(adapter.sendWhatsApp('inst-1', '+55', 'oi')).rejects.toThrow('Evolution API error');
  });
});
