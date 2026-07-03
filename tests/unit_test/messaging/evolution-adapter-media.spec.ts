import { EvolutionAdapter } from '@infra/integrations/evolution.adapter';

function cfg() {
  const b: Record<string, unknown> = { EVOLUTION_API_URL: 'https://evo', EVOLUTION_API_KEY: 'k' };
  return { get: (k: string) => b[k] };
}

describe('EvolutionAdapter.sendMedia', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts to /message/sendMedia/{instance} with mediatype/mimetype/media/fileName', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: true, text: jest.fn() });
    (global as any).fetch = fetchFn;
    const adapter = new EvolutionAdapter(cfg() as any);
    await adapter.sendMedia('inst-1', '+5511', 'https://cdn/f.pdf', 'document', 'application/pdf', 'f.pdf', 'legenda');
    expect(fetchFn.mock.calls[0][0]).toBe('https://evo/message/sendMedia/inst-1');
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body).toEqual(expect.objectContaining({
      number: '+5511', mediatype: 'document', mimetype: 'application/pdf',
      media: 'https://cdn/f.pdf', fileName: 'f.pdf', caption: 'legenda',
    }));
  });

  it('omits caption when not provided', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: true, text: jest.fn() });
    (global as any).fetch = fetchFn;
    const adapter = new EvolutionAdapter(cfg() as any);
    await adapter.sendMedia('inst-1', '+5511', 'https://cdn/a.png', 'image', 'image/png', 'a.png');
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.caption).toBeUndefined();
  });

  it('throws on non-ok response', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    const adapter = new EvolutionAdapter(cfg() as any);
    await expect(adapter.sendMedia('i', '+55', 'u', 'image', 'image/png', 'a.png')).rejects.toThrow('Evolution API error');
  });
});
