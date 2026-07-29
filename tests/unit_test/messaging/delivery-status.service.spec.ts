import { DeliveryStatusService } from '@modules/messaging/delivery-status.service';

function makePrisma() {
  return {
    outboxMessage: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    messageLog: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
}

describe('DeliveryStatusService.applyStatusUpdate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ignora quando não há providerMessageId nem trackId', async () => {
    const prisma = makePrisma();
    const svc = new DeliveryStatusService(prisma as any);
    await svc.applyStatusUpdate({ status: 'Delivered' });
    expect(prisma.outboxMessage.updateMany).not.toHaveBeenCalled();
  });

  it('Delivered: marca deliveredAt no outbox (por trackId) e status delivered no log', async () => {
    const prisma = makePrisma();
    const svc = new DeliveryStatusService(prisma as any);
    await svc.applyStatusUpdate({ trackId: 'outbox-1', providerMessageId: 'wamid.1', status: 'Delivered', at: 1000 });

    const call = prisma.outboxMessage.updateMany.mock.calls[0][0];
    expect(call.where).toEqual(expect.objectContaining({ id: 'outbox-1', deliveredAt: null, readAt: null }));
    expect(call.data).toEqual({ deliveredAt: new Date(1000) });
    expect(prisma.messageLog.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'delivered', deliveredAt: new Date(1000) }) }),
    );
  });

  it('Read: seta readAt e garante deliveredAt (read implica delivered)', async () => {
    const prisma = makePrisma();
    const svc = new DeliveryStatusService(prisma as any);
    await svc.applyStatusUpdate({ trackId: 'outbox-1', providerMessageId: 'wamid.1', status: 'Read', at: 2000 });

    const datas = prisma.outboxMessage.updateMany.mock.calls.map((c: any) => c[0].data);
    expect(datas).toEqual(expect.arrayContaining([{ readAt: new Date(2000) }, { deliveredAt: new Date(2000) }]));
    expect(prisma.messageLog.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'read' }) }),
    );
  });

  it('Failed: marca failed sem rebaixar entregues/lidas', async () => {
    const prisma = makePrisma();
    const svc = new DeliveryStatusService(prisma as any);
    await svc.applyStatusUpdate({ providerMessageId: 'wamid.1', status: 'Failed', error: 'boom' });

    expect(prisma.outboxMessage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ providerMessageId: 'wamid.1', deliveredAt: null, readAt: null }),
        data: { status: 'failed', errorMessage: 'boom' },
      }),
    );
  });

  it('Sent/Queued: no-op', async () => {
    const prisma = makePrisma();
    const svc = new DeliveryStatusService(prisma as any);
    await svc.applyStatusUpdate({ trackId: 'outbox-1', status: 'Sent' });
    await svc.applyStatusUpdate({ trackId: 'outbox-1', status: 'Queued' });
    expect(prisma.outboxMessage.updateMany).not.toHaveBeenCalled();
  });
});
