import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaEventRepository } from '@infra/repositories/event_module/prisma-event.repository';

function makeRepo(event: Record<string, jest.Mock>, transaction = jest.fn().mockResolvedValue([])) {
  const prisma = { event, $transaction: transaction } as unknown as PrismaService;
  return { repo: new PrismaEventRepository(prisma), transaction };
}

function listRepo() {
  const findMany = jest.fn().mockResolvedValue([]);
  const count = jest.fn().mockResolvedValue(0);
  const { repo } = makeRepo({ findMany, count });
  return { repo, findMany };
}

const ACCESSIBLE = {
  OR: [{ ownerId: 'user-1' }, { collaborators: { some: { profileId: 'user-1' } } }],
};

describe('PrismaEventRepository.findAllByOwnerPaginated folder scope', () => {
  it('applies no folder filter when the scope is undefined', async () => {
    const { repo, findMany } = listRepo();

    await repo.findAllByOwnerPaginated('user-1', { skip: 0, take: 20 });

    const [{ where }] = findMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(where).toEqual(ACCESSIBLE);
    expect(where).not.toHaveProperty('folderId');
  });

  // 'null' é como a query string pede a raiz; sem essa distinção o filtro cairia
  // silenciosamente em "todos os eventos".
  it('filters to events outside any folder on an explicit null', async () => {
    const { repo, findMany } = listRepo();

    await repo.findAllByOwnerPaginated('user-1', { skip: 0, take: 20 }, null);

    const [{ where }] = findMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(where).toEqual({ ...ACCESSIBLE, folderId: null });
  });

  it('filters to a given folder', async () => {
    const { repo, findMany } = listRepo();

    await repo.findAllByOwnerPaginated('user-1', { skip: 0, take: 20 }, 'fld-1');

    const [{ where }] = findMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(where).toEqual({ ...ACCESSIBLE, folderId: 'fld-1' });
  });

  it('orders by the manual order first, falling back to createdAt', async () => {
    const { repo, findMany } = listRepo();

    await repo.findAllByOwnerPaginated('user-1', { skip: 0, take: 20 });

    const [{ orderBy }] = findMany.mock.calls[0] as [{ orderBy: unknown }];
    expect(orderBy).toEqual([{ order: 'asc' }, { createdAt: 'desc' }]);
  });
});

describe('PrismaEventRepository.reorder', () => {
  it('writes the list index as order, scoped to the folder and to what the user can reach', async () => {
    const updateMany = jest.fn().mockImplementation((args) => args);
    const { repo, transaction } = makeRepo({ updateMany });

    await repo.reorder('user-1', 'fld-1', ['e2', 'e1']);

    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'e2', folderId: 'fld-1', ...ACCESSIBLE },
      data: { order: 0 },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'e1', folderId: 'fld-1', ...ACCESSIBLE },
      data: { order: 1 },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('reorders the root scope with a null folder', async () => {
    const updateMany = jest.fn().mockImplementation((args) => args);
    const { repo } = makeRepo({ updateMany });

    await repo.reorder('user-1', null, ['e1']);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'e1', folderId: null, ...ACCESSIBLE },
      data: { order: 0 },
    });
  });
});
