import { DeliveryStatusService } from '@application/outbox_module/delivery-status.service';
import { OutboxRepositoryPort } from '@domain/outbox_module/i-repository-outbox';
import { MessageLogRepositoryPort } from '@domain/message_log_module/i-repository-message-log';

function makeRepos() {
  const outboxRepo = {
    markDeliveredIfUnset: jest.fn().mockResolvedValue(undefined),
    markReadIfUnset: jest.fn().mockResolvedValue(undefined),
    markFailedIfUndelivered: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<
    Pick<
      OutboxRepositoryPort,
      'markDeliveredIfUnset' | 'markReadIfUnset' | 'markFailedIfUndelivered'
    >
  >;
  const messageLogs = {
    markDeliveredIfUnset: jest.fn().mockResolvedValue(undefined),
    markReadIfUnset: jest.fn().mockResolvedValue(undefined),
    markFailedIfUndelivered: jest.fn().mockResolvedValue(undefined),
    // Mock parcial: só os três métodos de transição de estado que este service usa.
  } as unknown as jest.Mocked<MessageLogRepositoryPort>;
  return { outboxRepo, messageLogs };
}

describe('DeliveryStatusService.applyStatusUpdate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ignora quando não há providerMessageId nem trackId', async () => {
    const { outboxRepo, messageLogs } = makeRepos();
    const svc = new DeliveryStatusService(outboxRepo as any, messageLogs);
    await svc.applyStatusUpdate({ status: 'Delivered' });
    expect(outboxRepo.markDeliveredIfUnset).not.toHaveBeenCalled();
  });

  it('Delivered: marca deliveredAt no outbox (por trackId) e status delivered no log', async () => {
    const { outboxRepo, messageLogs } = makeRepos();
    const svc = new DeliveryStatusService(outboxRepo as any, messageLogs);
    await svc.applyStatusUpdate({
      trackId: 'outbox-1',
      providerMessageId: 'wamid.1',
      status: 'Delivered',
      at: 1000,
    });

    expect(outboxRepo.markDeliveredIfUnset).toHaveBeenCalledWith(
      { providerMessageId: 'wamid.1', trackId: 'outbox-1' },
      new Date(1000),
    );
    expect(messageLogs.markDeliveredIfUnset).toHaveBeenCalledWith('wamid.1', new Date(1000));
  });

  it('Read: seta readAt e garante deliveredAt (read implica delivered)', async () => {
    const { outboxRepo, messageLogs } = makeRepos();
    const svc = new DeliveryStatusService(outboxRepo as any, messageLogs);
    await svc.applyStatusUpdate({
      trackId: 'outbox-1',
      providerMessageId: 'wamid.1',
      status: 'Read',
      at: 2000,
    });

    expect(outboxRepo.markReadIfUnset).toHaveBeenCalledWith(
      { providerMessageId: 'wamid.1', trackId: 'outbox-1' },
      new Date(2000),
    );
    expect(messageLogs.markReadIfUnset).toHaveBeenCalledWith('wamid.1', new Date(2000));
  });

  it('Failed: marca failed sem rebaixar entregues/lidas', async () => {
    const { outboxRepo, messageLogs } = makeRepos();
    const svc = new DeliveryStatusService(outboxRepo as any, messageLogs);
    await svc.applyStatusUpdate({ providerMessageId: 'wamid.1', status: 'Failed', error: 'boom' });

    expect(outboxRepo.markFailedIfUndelivered).toHaveBeenCalledWith(
      { providerMessageId: 'wamid.1', trackId: undefined },
      'boom',
    );
    expect(messageLogs.markFailedIfUndelivered).toHaveBeenCalledWith('wamid.1', 'boom');
  });

  it('Sent/Queued: no-op', async () => {
    const { outboxRepo, messageLogs } = makeRepos();
    const svc = new DeliveryStatusService(outboxRepo as any, messageLogs);
    await svc.applyStatusUpdate({ trackId: 'outbox-1', status: 'Sent' });
    await svc.applyStatusUpdate({ trackId: 'outbox-1', status: 'Queued' });
    expect(outboxRepo.markDeliveredIfUnset).not.toHaveBeenCalled();
  });
});
