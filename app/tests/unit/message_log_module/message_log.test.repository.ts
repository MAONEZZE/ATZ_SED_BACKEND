import { Test } from '@nestjs/testing';
import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaMessageLogRepository } from '@infra/repositories/message_log_module/prisma-message-log.repository';
import { MessageLogEntity } from '@domain/message_log_module/message-log.entity';

const ROW = {
  id: 'log-1',
  eventId: 'evt-1',
  ownerId: 'owner-1',
  registrationId: 'reg-1',
  channel: 'whatsapp',
  recipient: '5511999999999',
  body: 'Oi',
  status: 'sent',
  errorMessage: null,
  providerMessageId: 'prov-1',
  deliveredAt: null,
  readAt: null,
  sentAt: new Date('2026-04-01'),
  createdAt: new Date('2026-04-01'),
};

async function makeRepo(messageLog: Record<string, jest.Mock> = {}) {
  const prismaMock = { messageLog } as unknown as PrismaService;
  const moduleRef = await Test.createTestingModule({
    providers: [PrismaMessageLogRepository, { provide: PrismaService, useValue: prismaMock }],
  }).compile();
  return { repo: moduleRef.get(PrismaMessageLogRepository), prismaMock };
}

// Boots Nest DI (not `new Repo(mock)`) to prove the inherited
// PrismaRepositoryBase constructor injects PrismaService.
describe('PrismaMessageLogRepository DI', () => {
  it('injects PrismaService through the inherited base constructor', async () => {
    const { repo, prismaMock } = await makeRepo();
    expect((repo as unknown as { prisma: unknown }).prisma).toBe(prismaMock);
  });
});

describe('PrismaMessageLogRepository mapping', () => {
  it('returns MessageLogEntity instances', async () => {
    const { repo } = await makeRepo({
      findMany: jest.fn().mockResolvedValue([ROW]),
      count: jest.fn().mockResolvedValue(1),
    });

    const { data, total } = await repo.findByEventPaginated('evt-1', { skip: 0, take: 20 });

    expect(total).toBe(1);
    expect(data[0]).toBeInstanceOf(MessageLogEntity);
    expect(data[0].isDelivered()).toBe(false);
  });

  // A message logged before its delivery webhook arrives has both timestamps
  // null; read implies delivered even if the delivered webhook never came.
  it('treats a read message as delivered', async () => {
    const { repo } = await makeRepo({
      findMany: jest.fn().mockResolvedValue([{ ...ROW, readAt: new Date(), deliveredAt: null }]),
    });

    const [log] = await repo.streamByEvent('evt-1', 20);

    expect(log.isRead()).toBe(true);
    expect(log.isDelivered()).toBe(true);
  });

  // The global list serialises straight into the HTTP body, so the joined event
  // is attached to the entity rather than wrapping it.
  it('attaches the joined event to the entity on the user-wide list', async () => {
    const { repo } = await makeRepo({
      findMany: jest.fn().mockResolvedValue([{ ...ROW, event: { id: 'evt-1', title: 'Festa' } }]),
      count: jest.fn().mockResolvedValue(1),
    });

    const { data } = await repo.findAllForUserPaginated('owner-1', { skip: 0, take: 20 });

    expect(data[0]).toBeInstanceOf(MessageLogEntity);
    expect(data[0].event).toEqual({ id: 'evt-1', title: 'Festa' });
    expect(JSON.parse(JSON.stringify(data[0]))).toMatchObject({
      id: 'log-1',
      recipient: '5511999999999',
      event: { id: 'evt-1', title: 'Festa' },
    });
  });
});

// A message sent in parts produces several logs sharing one providerMessageId,
// and the provider's webhooks can arrive out of order — so the transitions are
// updateMany guarded by the current state, never an update by id.
describe('PrismaMessageLogRepository status transitions', () => {
  it('does not demote a message that was already read', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const { repo } = await makeRepo({ updateMany });
    const at = new Date('2026-04-02');

    await repo.markDeliveredIfUnset('prov-1', at);

    expect(updateMany).toHaveBeenCalledWith({
      where: { providerMessageId: 'prov-1', deliveredAt: null, readAt: null },
      data: { deliveredAt: at, status: 'delivered' },
    });
  });

  it('backfills deliveredAt when a read arrives without a prior delivery', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const { repo } = await makeRepo({ updateMany });
    const at = new Date('2026-04-02');

    await repo.markReadIfUnset('prov-1', at);

    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { providerMessageId: 'prov-1', readAt: null },
      data: { readAt: at, status: 'read' },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { providerMessageId: 'prov-1', deliveredAt: null },
      data: { deliveredAt: at },
    });
  });

  it('only fails messages that never reached the recipient', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const { repo } = await makeRepo({ updateMany });

    await repo.markFailedIfUndelivered('prov-1', 'boom');

    expect(updateMany).toHaveBeenCalledWith({
      where: { providerMessageId: 'prov-1', deliveredAt: null, readAt: null },
      data: { status: 'failed', errorMessage: 'boom' },
    });
  });
});
