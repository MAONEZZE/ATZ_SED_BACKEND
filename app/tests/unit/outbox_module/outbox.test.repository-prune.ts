import { PrismaOutboxRepository } from '@infra/repositories/outbox_module/prisma-outbox.repository';

describe('PrismaOutboxRepository.deleteSentOlderThan', () => {
  it('deletes only sent rows older than the cutoff', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 7 });
    const repo = new PrismaOutboxRepository({ outboxMessage: { deleteMany } } as any);
    const cutoff = new Date('2026-02-22T00:00:00Z');

    const count = await repo.deleteSentOlderThan(cutoff);

    expect(deleteMany).toHaveBeenCalledWith({
      where: { status: 'sent', createdAt: { lt: cutoff } },
    });
    expect(count).toBe(7);
  });
});
