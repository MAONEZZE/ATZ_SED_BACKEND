import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaEventRepository } from '@infra/repositories/event_module/prisma-event.repository';

const ACCESSIBLE = {
  OR: [{ ownerId: 'user-1' }, { collaborators: { some: { profileId: 'user-1' } } }],
};

function makeRepo(
  item: { folderId: string | null } | null,
  rows: Array<{ id: string; order: number }>,
) {
  const findFirst = jest.fn().mockResolvedValue(item);
  const findMany = jest.fn().mockResolvedValue(rows);
  const update = jest.fn((args: { where: { id: string }; data: { order: number } }) => args);
  const transaction = jest.fn().mockResolvedValue([]);
  const prisma = {
    event: { findFirst, findMany, update },
    $transaction: transaction,
  } as unknown as PrismaService;
  return { repo: new PrismaEventRepository(prisma), findMany, update, transaction };
}

const ROWS = [
  { id: 'evt-a', order: 0 },
  { id: 'evt-b', order: 1 },
  { id: 'evt-c', order: 2 },
];

describe('PrismaEventRepository.move', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rewrites only the orders that changed', async () => {
    const { repo, update } = makeRepo({ folderId: null }, ROWS);

    await expect(repo.move('user-1', 'evt-c', 'evt-b')).resolves.toBe(true);

    expect(update.mock.calls.map(([args]) => args)).toEqual([
      { where: { id: 'evt-c' }, data: { order: 1 } },
      { where: { id: 'evt-b' }, data: { order: 2 } },
    ]);
  });

  // O escopo é a pasta em que o item já está: mover não troca de pasta (isso é
  // PATCH /events/:id com folderId).
  it('scopes the sequence to the folder of the dragged event', async () => {
    const { repo, findMany } = makeRepo({ folderId: 'fld-1' }, ROWS);

    await repo.move('user-1', 'evt-c', 'evt-a');

    const [{ where, orderBy }] = findMany.mock.calls[0] as [Record<string, unknown>];
    expect(where).toEqual({ folderId: 'fld-1', ...ACCESSIBLE });
    expect(orderBy).toEqual([{ order: 'asc' }, { createdAt: 'desc' }]);
  });

  it('returns false and writes nothing when the anchor is outside the scope', async () => {
    const { repo, update, transaction } = makeRepo({ folderId: null }, ROWS);

    await expect(repo.move('user-1', 'evt-a', 'evt-de-outra-pasta')).resolves.toBe(false);

    expect(update).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns false when the event is not accessible', async () => {
    const { repo, findMany } = makeRepo(null, ROWS);

    await expect(repo.move('user-1', 'evt-de-outro-usuario')).resolves.toBe(false);

    expect(findMany).not.toHaveBeenCalled();
  });

  it('sends the event to the end without an anchor', async () => {
    const { repo, update } = makeRepo({ folderId: null }, ROWS);

    await repo.move('user-1', 'evt-a');

    expect(update.mock.calls.map(([args]) => args)).toEqual([
      { where: { id: 'evt-b' }, data: { order: 0 } },
      { where: { id: 'evt-c' }, data: { order: 1 } },
      { where: { id: 'evt-a' }, data: { order: 2 } },
    ]);
  });
});
