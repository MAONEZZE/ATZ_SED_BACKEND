import { UazapiAdapter } from '@infra/integrations/uazapi.adapter';

function makeConfig(over: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    UAZAPI_API_URL: 'https://free.uazapi.com',
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
  const fn = jest
    .fn()
    .mockResolvedValue({ ok: true, text: jest.fn(), json: async () => ({ messageid: 'wamid.TEST' }) });
  (global as any).fetch = fn;
  return fn;
}

function lastBody(fetchFn: jest.Mock) {
  return JSON.parse(fetchFn.mock.calls[0][1].body);
}

describe('UazapiAdapter.sendWhatsApp', () => {
  beforeEach(() => jest.clearAllMocks());

  it('inclui delay de digitação no payload quando typing habilitado', async () => {
    const fetchFn = mockFetchOk();
    const adapter = new UazapiAdapter(makeConfig() as any);
    await adapter.sendWhatsApp('token-1', '+5511999999999', 'oi');
    expect(lastBody(fetchFn).delay).toBe(2000);
  });

  it('envia para /send/text com o header token', async () => {
    const fetchFn = mockFetchOk();
    const adapter = new UazapiAdapter(makeConfig() as any);
    await adapter.sendWhatsApp('token-1', '+5511999999999', 'oi');
    expect(fetchFn.mock.calls[0][0]).toBe('https://free.uazapi.com/send/text');
    expect(fetchFn.mock.calls[0][1].headers).toEqual(
      expect.objectContaining({ token: 'token-1' }),
    );
  });

  it('soma tempo proporcional ao tamanho do texto', async () => {
    const fetchFn = mockFetchOk();
    const adapter = new UazapiAdapter(makeConfig({ WA_TYPING_MS_PER_CHAR: 10 }) as any);
    await adapter.sendWhatsApp('token-1', '+5511999999999', 'abcde'); // 5 chars
    expect(lastBody(fetchFn).delay).toBe(2000 + 5 * 10);
  });

  it('respeita o teto WA_TYPING_MAX_TOTAL_MS', async () => {
    const fetchFn = mockFetchOk();
    const adapter = new UazapiAdapter(
      makeConfig({
        WA_TYPING_MIN_MS: 5000,
        WA_TYPING_MAX_MS: 5000,
        WA_TYPING_MAX_TOTAL_MS: 3000,
      }) as any,
    );
    await adapter.sendWhatsApp('token-1', '+5511999999999', 'oi');
    expect(lastBody(fetchFn).delay).toBe(3000);
  });

  it('não inclui delay quando typing desabilitado', async () => {
    const fetchFn = mockFetchOk();
    const adapter = new UazapiAdapter(makeConfig({ WA_TYPING_ENABLED: false }) as any);
    await adapter.sendWhatsApp('token-1', '+5511999999999', 'oi');
    expect(lastBody(fetchFn).delay).toBeUndefined();
  });

  it('lança em resposta não-ok', async () => {
    const fn = jest.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'bad' });
    (global as any).fetch = fn;
    const adapter = new UazapiAdapter(makeConfig() as any);
    await expect(adapter.sendWhatsApp('token-1', '+55', 'oi')).rejects.toThrow('Uazapi API error');
  });

  it('inclui track_id/track_source quando trackId informado e retorna o messageid', async () => {
    const fetchFn = mockFetchOk();
    const adapter = new UazapiAdapter(makeConfig() as any);
    const id = await adapter.sendWhatsApp('token-1', '+5511999999999', 'oi', { trackId: 'outbox-1' });
    expect(id).toBe('wamid.TEST');
    const body = lastBody(fetchFn);
    expect(body.track_id).toBe('outbox-1');
    expect(body.track_source).toBe('sed');
  });

  it('não inclui track_id quando não informado', async () => {
    const fetchFn = mockFetchOk();
    const adapter = new UazapiAdapter(makeConfig() as any);
    await adapter.sendWhatsApp('token-1', '+5511999999999', 'oi');
    expect(lastBody(fetchFn).track_id).toBeUndefined();
  });

  it('setWebhook posta em /webhook com token, url, events e action add', async () => {
    const fetchFn = mockFetchOk();
    const adapter = new UazapiAdapter(makeConfig() as any);
    await adapter.setWebhook('token-1', 'https://api.sed/webhooks/uazapi?secret=x', ['messages_update']);
    expect(fetchFn.mock.calls[0][0]).toBe('https://free.uazapi.com/webhook');
    expect(fetchFn.mock.calls[0][1].headers).toEqual(expect.objectContaining({ token: 'token-1' }));
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body).toEqual(
      expect.objectContaining({
        url: 'https://api.sed/webhooks/uazapi?secret=x',
        events: ['messages_update'],
        action: 'add',
        enabled: true,
      }),
    );
  });
});

describe('UazapiAdapter.getInstanceStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET /instance/status com header token, retorna status do topo', async () => {
    const fn = jest
      .fn()
      .mockResolvedValue({ ok: true, text: jest.fn(), json: async () => ({ status: 'connected' }) });
    (global as any).fetch = fn;
    const adapter = new UazapiAdapter(makeConfig() as any);
    const status = await adapter.getInstanceStatus('token-1');
    expect(status).toBe('connected');
    expect(fn.mock.calls[0][0]).toBe('https://free.uazapi.com/instance/status');
    expect(fn.mock.calls[0][1].headers).toEqual(expect.objectContaining({ token: 'token-1' }));
  });

  it('parseia status aninhado em instance', async () => {
    const fn = jest
      .fn()
      .mockResolvedValue({ ok: true, text: jest.fn(), json: async () => ({ instance: { status: 'connecting' } }) });
    (global as any).fetch = fn;
    const adapter = new UazapiAdapter(makeConfig() as any);
    expect(await adapter.getInstanceStatus('token-1')).toBe('connecting');
  });

  it('retorna null em resposta não-ok (não lança)', async () => {
    const fn = jest.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' });
    (global as any).fetch = fn;
    const adapter = new UazapiAdapter(makeConfig() as any);
    expect(await adapter.getInstanceStatus('token-1')).toBeNull();
  });

  it('retorna null em falha de rede/timeout (não lança)', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('network down'));
    (global as any).fetch = fn;
    const adapter = new UazapiAdapter(makeConfig() as any);
    expect(await adapter.getInstanceStatus('token-1')).toBeNull();
  });

  it('retorna null quando o corpo não traz status', async () => {
    const fn = jest.fn().mockResolvedValue({ ok: true, text: jest.fn(), json: async () => ({}) });
    (global as any).fetch = fn;
    const adapter = new UazapiAdapter(makeConfig() as any);
    expect(await adapter.getInstanceStatus('token-1')).toBeNull();
  });
});
