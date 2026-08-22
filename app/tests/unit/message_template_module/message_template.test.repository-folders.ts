import { Test } from '@nestjs/testing';
import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaMessageTemplateRepository } from '@infra/repositories/message_template_module/prisma-message-template.repository';

const ACCESSIBLE = {
  OR: [
    { ownerId: 'user-1' },
    { event: { OR: [{ ownerId: 'user-1' }, { collaborators: { some: { profileId: 'user-1' } } }] } },
  ],
};

async function makeRepo(messageTemplate: Record<string, jest.Mock> = {}, transaction = jest.fn()) {
  const prismaMock = { messageTemplate, $transaction: transaction } as unknown as PrismaService;
  const moduleRef = await Test.createTestingModule({
    providers: [PrismaMessageTemplateRepository, { provide: PrismaService, useValue: prismaMock }],
  }).compile();
  return { repo: moduleRef.get(PrismaMessageTemplateRepository), transaction };
}

async function listWith(filter: object) {
  const findMany = jest.fn().mockResolvedValue([]);
  const count = jest.fn().mockResolvedValue(0);
  const { repo } = await makeRepo({ findMany, count });

  await repo.findAllForOwnerPaginated('user-1', filter, { skip: 0, take: 20 });

  return findMany.mock.calls[0][0];
}

describe('PrismaMessageTemplateRepository folder filter', () => {
  it('omits folderId from the where when the filter does not mention it', async () => {
    expect(await listWith({})).toEqual(
      expect.objectContaining({ where: { ownerId: 'user-1' } }),
    );
  });

  it('filters templates outside any folder with an explicit null', async () => {
    const { where } = await listWith({ folderId: null });

    expect(where).toEqual({ ownerId: 'user-1', folderId: null });
  });

  it('filters by a folder id', async () => {
    const { where } = await listWith({ folderId: 'fld-1' });

    expect(where).toEqual({ ownerId: 'user-1', folderId: 'fld-1' });
  });

  // O escopo de evento é um OR (do evento + globais do dono); a pasta entra como
  // filtro adicional sobre esse conjunto.
  it('keeps the event OR and adds the folder filter on top', async () => {
    const { where } = await listWith({ eventId: 'evt-1', folderId: 'fld-1' });

    expect(where).toEqual({
      OR: [{ eventId: 'evt-1' }, { ownerId: 'user-1', eventId: null }],
      folderId: 'fld-1',
    });
  });

  // `order` vem antes de createdAt por causa do drag & drop; como toda linha
  // nasce com 0, a ordem antiga se mantém até alguém reordenar.
  it('orders by the manual order before createdAt', async () => {
    const { orderBy } = await listWith({});

    expect(orderBy).toEqual([{ order: 'asc' }, { createdAt: 'desc' }]);
  });
});

describe('PrismaMessageTemplateRepository.reorder', () => {
  it('writes the list index as order, scoped to the folder and to what the user reaches', async () => {
    const updateMany = jest.fn().mockImplementation((args) => args);
    const transaction = jest.fn().mockResolvedValue([]);
    const { repo } = await makeRepo({ updateMany }, transaction);

    await repo.reorder('user-1', 'fld-1', ['b', 'a']);

    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'b', folderId: 'fld-1', ...ACCESSIBLE },
      data: { order: 0 },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'a', folderId: 'fld-1', ...ACCESSIBLE },
      data: { order: 1 },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('reorders the templates outside any folder', async () => {
    const updateMany = jest.fn().mockImplementation((args) => args);
    const { repo } = await makeRepo({ updateMany }, jest.fn().mockResolvedValue([]));

    await repo.reorder('user-1', null, ['b']);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'b', folderId: null, ...ACCESSIBLE },
      data: { order: 0 },
    });
  });
});
