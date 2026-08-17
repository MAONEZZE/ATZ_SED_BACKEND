import { Test } from '@nestjs/testing';
import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaAutomationRepository } from '@infra/repositories/automation_module/prisma-automation.repository';

async function makeRepo(automationRule: Record<string, jest.Mock> = {}, transaction = jest.fn()) {
  const prismaMock = { automationRule, $transaction: transaction } as unknown as PrismaService;
  const moduleRef = await Test.createTestingModule({
    providers: [PrismaAutomationRepository, { provide: PrismaService, useValue: prismaMock }],
  }).compile();
  return { repo: moduleRef.get(PrismaAutomationRepository), transaction };
}

async function listByEvent(folderId?: string | null) {
  const findMany = jest.fn().mockResolvedValue([]);
  const count = jest.fn().mockResolvedValue(0);
  const { repo } = await makeRepo({ findMany, count });

  await repo.findAllByEventPaginated('evt-1', { skip: 0, take: 20 }, folderId);

  return findMany.mock.calls[0][0];
}

describe('PrismaAutomationRepository.findAllByEventPaginated folder scope', () => {
  it('omits folderId from the where when no scope is given', async () => {
    const { where } = await listByEvent();

    expect(where).toEqual({ eventId: 'evt-1' });
    expect(where).not.toHaveProperty('folderId');
  });

  it('filters rules outside any folder with an explicit null', async () => {
    const { where } = await listByEvent(null);

    expect(where).toEqual({ eventId: 'evt-1', folderId: null });
  });

  it('filters by a folder id', async () => {
    const { where } = await listByEvent('fld-1');

    expect(where).toEqual({ eventId: 'evt-1', folderId: 'fld-1' });
  });

  it('orders by the manual order before createdAt', async () => {
    const { orderBy } = await listByEvent();

    expect(orderBy).toEqual([{ order: 'asc' }, { createdAt: 'asc' }]);
  });
});

// A lista global atravessa eventos, e `order` só tem significado dentro de um
// evento — então essa continua ordenada por data.
describe('PrismaAutomationRepository.findAllForUserPaginated ordering', () => {
  it('keeps ordering by createdAt desc', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { repo } = await makeRepo({ findMany, count: jest.fn().mockResolvedValue(0) });

    await repo.findAllForUserPaginated('user-1', { skip: 0, take: 20 });

    expect(findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' });
  });
});

describe('PrismaAutomationRepository.reorder', () => {
  it('writes the list index as order, scoped to the event and the folder', async () => {
    const updateMany = jest.fn().mockImplementation((args) => args);
    const transaction = jest.fn().mockResolvedValue([]);
    const { repo } = await makeRepo({ updateMany }, transaction);

    await repo.reorder('evt-1', 'fld-1', ['b', 'a']);

    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'b', eventId: 'evt-1', folderId: 'fld-1' },
      data: { order: 0 },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'a', eventId: 'evt-1', folderId: 'fld-1' },
      data: { order: 1 },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('reorders the rules outside any folder', async () => {
    const updateMany = jest.fn().mockImplementation((args) => args);
    const { repo } = await makeRepo({ updateMany }, jest.fn().mockResolvedValue([]));

    await repo.reorder('evt-1', null, ['b']);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'b', eventId: 'evt-1', folderId: null },
      data: { order: 0 },
    });
  });
});
