import { UnauthorizedException } from '@nestjs/common';
import { WhatsappWebhookController } from '@modules/public/whatsapp-webhook.controller';

function make(secret = 'sekret') {
  const config = { get: jest.fn((k: string) => (k === 'WHATSAPP_WEBHOOK_SECRET' ? secret : undefined)) };
  const delivery = { applyStatusUpdate: jest.fn().mockResolvedValue(undefined) };
  const ctrl = new WhatsappWebhookController(config as any, delivery as any);
  return { ctrl, delivery };
}

const statusEvent = {
  event: 'status',
  instance: 'inst-1',
  data: { messageid: 'wamid.1', status: 'Delivered', track_id: 'outbox-1', messageTimestamp: 1234 },
};

describe('WhatsappWebhookController.receive', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejeita secret inválido', async () => {
    const { ctrl, delivery } = make();
    await expect(ctrl.receive('errado', undefined, statusEvent as any)).rejects.toThrow(UnauthorizedException);
    expect(delivery.applyStatusUpdate).not.toHaveBeenCalled();
  });

  it('aceita secret via query e aplica status', async () => {
    const { ctrl, delivery } = make();
    const res = await ctrl.receive('sekret', undefined, statusEvent as any);
    expect(res).toEqual({ ok: true });
    expect(delivery.applyStatusUpdate).toHaveBeenCalledWith({
      providerMessageId: 'wamid.1',
      trackId: 'outbox-1',
      status: 'Delivered',
      at: 1234,
      error: null,
    });
  });

  it('aceita secret via header', async () => {
    const { ctrl, delivery } = make();
    await ctrl.receive(undefined, 'sekret', statusEvent as any);
    expect(delivery.applyStatusUpdate).toHaveBeenCalled();
  });

  it('ignora eventos que não são status (200 OK, sem update)', async () => {
    const { ctrl, delivery } = make();
    const res = await ctrl.receive('sekret', undefined, { event: 'presence', data: {} } as any);
    expect(res).toEqual({ ok: true });
    expect(delivery.applyStatusUpdate).not.toHaveBeenCalled();
  });
});
