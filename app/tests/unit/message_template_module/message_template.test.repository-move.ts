import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaMessageTemplateRepository } from '@infra/repositories/message_template_module/prisma-message-template.repository';

const ACCESSIBLE = {
  OR: [
    { ownerId: 'user-1' },
    {
      event: { OR: [{ ownerId: 'user-1' }, { collaborators: { some: { profileId: 'user-1' } } }] },
    },
  ],
};

function makeRepo() {
  const findFirst = jest.fn().mockResolvedValue({ folderId: 'fld-1' });
  const findMany = jest.fn().mockResolvedValue([
    { id: 'tpl-a', order: 0 },
    { id: 'tpl-b', order: 1 },
  ]);
  const update = jest.fn((args: { where: { id: string }; data: { order: number } }) => args);
  const prisma = {
    messageTemplate: { findFirst, findMany, update },
    $transaction: jest.fn().mockResolvedValue([]),
  } as unknown as PrismaService;
  return { repo: new PrismaMessageTemplateRepository(prisma), findMany, update };
}

describe('PrismaMessageTemplateRepository.move', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sequences only the folder of the dragged template, within what the user can access', async () => {
    const { repo, findMany, update } = makeRepo();

    await expect(repo.move('user-1', 'tpl-b', 'tpl-a')).resolves.toBe(true);

    const [{ where, orderBy }] = findMany.mock.calls[0] as [Record<string, unknown>];
    expect(where).toEqual({ folderId: 'fld-1', ...ACCESSIBLE });
    // Mesmo desempate da listagem (`findAllForOwnerPaginated`).
    expect(orderBy).toEqual([{ order: 'asc' }, { createdAt: 'desc' }]);
    expect(update.mock.calls.map(([args]) => args)).toEqual([
      { where: { id: 'tpl-b' }, data: { order: 0 } },
      { where: { id: 'tpl-a' }, data: { order: 1 } },
    ]);
  });
});
