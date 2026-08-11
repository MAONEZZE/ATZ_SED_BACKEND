import { WhatsappAdapter } from '@infra/integrations/whatsapp.adapter';

function cfg() {
  const b: Record<string, unknown> = { WHATSAPP_API_URL: 'https://uaz' };
  return { get: (k: string) => b[k] };
}

describe('WhatsappAdapter.sendMedia', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts to /send/media with type/mimetype/file/docName and token header', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: true, text: jest.fn(), json: async () => ({ messageid: 'wamid.M' }) });
    (global as any).fetch = fetchFn;
    const adapter = new WhatsappAdapter(cfg() as any);
    await adapter.sendMedia('token-1', '+5511', 'https://cdn/f.pdf', 'document', 'application/pdf', 'f.pdf', 'legenda');
    expect(fetchFn.mock.calls[0][0]).toBe('https://uaz/send/media');
    expect(fetchFn.mock.calls[0][1].headers).toEqual(expect.objectContaining({ token: 'token-1' }));
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body).toEqual(expect.objectContaining({
      number: '+5511', type: 'document', mimetype: 'application/pdf',
      file: 'https://cdn/f.pdf', docName: 'f.pdf', text: 'legenda',
    }));
  });

  it('omits caption (text) when not provided', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: true, text: jest.fn(), json: async () => ({ messageid: 'wamid.M' }) });
    (global as any).fetch = fetchFn;
    const adapter = new WhatsappAdapter(cfg() as any);
    await adapter.sendMedia('token-1', '+5511', 'https://cdn/a.png', 'image', 'image/png', 'a.png');
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.text).toBeUndefined();
  });

  it('throws on non-ok response', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    const adapter = new WhatsappAdapter(cfg() as any);
    await expect(adapter.sendMedia('t', '+55', 'u', 'image', 'image/png', 'a.png')).rejects.toThrow('Whatsapp API error');
  });
});
