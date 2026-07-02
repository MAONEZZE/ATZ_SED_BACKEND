import { PrismaOutboxRepository } from '@modules/messaging/prisma-outbox.repository';

describe('PrismaOutboxRepository.enqueue attachments', () => {
  it('persists attachments as JSON', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'o1' });
    const prisma = { outboxMessage: { create } };
    const repo = new PrismaOutboxRepository(prisma as any);
    await repo.enqueue({
      trigger: 'manual',
      channel: 'email',
      recipient: 'x@y.com',
      renderedBody: 'oi',
      dedupKey: 'k1',
      attachments: [{ url: 'https://cdn/f.pdf', filename: 'f.pdf', mimetype: 'application/pdf' }],
    } as any);
    expect(create.mock.calls[0][0].data.attachments).toEqual([
      { url: 'https://cdn/f.pdf', filename: 'f.pdf', mimetype: 'application/pdf' },
    ]);
  });

  it('writes JsonNull when no attachments', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'o1' });
    const repo = new PrismaOutboxRepository({ outboxMessage: { create } } as any);
    await repo.enqueue({
      trigger: 'manual',
      channel: 'email',
      recipient: 'x',
      renderedBody: 'oi',
      dedupKey: 'k2',
    } as any);
    // Prisma.JsonNull is defined (not undefined)
    expect(create.mock.calls[0][0].data.attachments).toBeDefined();
  });
});
