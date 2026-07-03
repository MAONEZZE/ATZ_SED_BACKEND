const send = jest.fn().mockResolvedValue({ error: null });
jest.mock('resend', () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send } })) }));
import { ResendAdapter } from '@infra/integrations/resend.adapter';

describe('ResendAdapter.sendEmail attachments', () => {
  beforeEach(() => jest.clearAllMocks());
  const cfg = { get: (k: string) => (k === 'RESEND_FROM_EMAIL' ? 'from@x.com' : 'key') };

  it('maps user attachments to Resend path field alongside ics', async () => {
    const adapter = new ResendAdapter(cfg as any);
    await adapter.sendEmail('to@x.com', 'sub', '<p>hi</p>', 'ICSDATA', [
      { filename: 'contrato.pdf', url: 'https://cdn/contrato.pdf' },
    ]);
    const arg = send.mock.calls[0][0];
    expect(arg.attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ filename: 'contrato.pdf', path: 'https://cdn/contrato.pdf' }),
        expect.objectContaining({ filename: 'evento.ics' }),
      ]),
    );
  });

  it('sends only user attachments when no ics', async () => {
    const adapter = new ResendAdapter(cfg as any);
    await adapter.sendEmail('to@x.com', 'sub', '<p>hi</p>', undefined, [
      { filename: 'a.png', url: 'https://cdn/a.png' },
    ]);
    const arg = send.mock.calls[0][0];
    expect(arg.attachments).toEqual([{ filename: 'a.png', path: 'https://cdn/a.png' }]);
  });

  it('no attachments key stays empty array when neither ics nor files', async () => {
    const adapter = new ResendAdapter(cfg as any);
    await adapter.sendEmail('to@x.com', 'sub', '<p>hi</p>');
    const arg = send.mock.calls[0][0];
    expect(arg.attachments).toEqual([]);
  });
});
