import { Test } from '@nestjs/testing';
import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaFolderRepository } from '@infra/repositories/folder_module/prisma-folder.repository';
import { FolderEntity } from '@domain/folder_module/folder.entity';
import { FolderScope } from '@domain/folder_module/i-repository-folder';

const ROW = {
  id: 'fld-1',
  ownerId: 'user-1',
  name: 'Eventos 2026',
  parentId: null,
  order: 0,
  createdAt: new Date('2026-08-01'),
  updatedAt: new Date('2026-08-02'),
  resourceType: 'event' as const,
  eventId: null,
};

const PANEL: FolderScope = { ownerId: 'user-1', eventId: null, resourceType: 'event' };
const IN_EVENT: FolderScope = {
  ownerId: 'user-1',
  eventId: 'ev-1',
  resourceType: 'automation_rule',
};

async function makeRepo(folder: Record<string, jest.Mock> = {}, transaction = jest.fn()) {
  const prismaMock = { folder, $transaction: transaction } as unknown as PrismaService;
  const moduleRef = await Test.createTestingModule({
    providers: [PrismaFolderRepository, { provide: PrismaService, useValue: prismaMock }],
  }).compile();
  return { repo: moduleRef.get(PrismaFolderRepository), transaction };
}

// Boots Nest DI (not `new Repo(mock)`) to prove the inherited
// PrismaRepositoryBase constructor injects PrismaService.
describe('PrismaFolderRepository DI', () => {
  it('injects PrismaService through the inherited base constructor', async () => {
    const prismaMock = {} as unknown as PrismaService;
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaFolderRepository, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    const repo = moduleRef.get(PrismaFolderRepository);
    expect((repo as unknown as { prisma: unknown }).prisma).toBe(prismaMock);
  });
});

describe('PrismaFolderRepository.listByScope', () => {
  it('orders siblings by order then createdAt and maps to entities', async () => {
    const findMany = jest.fn().mockResolvedValue([ROW]);
    const { repo } = await makeRepo({ findMany });

    const folders = await repo.listByScope(PANEL);

    expect(findMany).toHaveBeenCalledWith({
      where: { resourceType: 'event', ownerId: 'user-1', eventId: null },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    expect(folders[0]).toBeInstanceOf(FolderEntity);
    expect(folders[0].isRoot()).toBe(true);
    expect(folders[0].livesInEvent()).toBe(false);
  });

  // É o que faz a pasta acompanhar o evento no compartilhamento: quem criou não
  // entra na consulta, senão o colaborador não veria as pastas do evento.
  it('filters an event scope by the event and ignores who created the folder', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { repo } = await makeRepo({ findMany });

    await repo.listByScope(IN_EVENT);

    const { where } = findMany.mock.calls[0][0];
    expect(where).toEqual({ resourceType: 'automation_rule', eventId: 'ev-1' });
    expect(where).not.toHaveProperty('ownerId');
  });
});

describe('PrismaFolderRepository.create', () => {
  it('puts a new folder at the end of its sibling scope', async () => {
    const create = jest.fn().mockResolvedValue({ ...ROW, order: 3 });
    const findFirst = jest.fn().mockResolvedValue({ order: 2 });
    const { repo } = await makeRepo({ create, findFirst });

    await repo.create({
      ownerId: 'user-1',
      resourceType: 'event',
      eventId: null,
      name: 'Nova',
      parentId: 'fld-parent',
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        resourceType: 'event',
        ownerId: 'user-1',
        eventId: null,
        parentId: 'fld-parent',
      },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        ownerId: 'user-1',
        resourceType: 'event',
        eventId: null,
        name: 'Nova',
        parentId: 'fld-parent',
        order: 3,
      },
    });
  });

  it('starts at order 0 when the scope is empty', async () => {
    const create = jest.fn().mockResolvedValue(ROW);
    const { repo } = await makeRepo({ create, findFirst: jest.fn().mockResolvedValue(null) });

    await repo.create({
      ownerId: 'user-1',
      resourceType: 'message_template',
      eventId: null,
      name: 'Nova',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        ownerId: 'user-1',
        resourceType: 'message_template',
        eventId: null,
        name: 'Nova',
        parentId: null,
        order: 0,
      },
    });
  });

  // Dentro do evento o "último irmão" é contado no escopo do evento, não no do
  // criador — senão duas pessoas criando pasta no mesmo evento colidiriam.
  it('counts the last sibling within the event scope', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const { repo } = await makeRepo({ findFirst, create: jest.fn().mockResolvedValue(ROW) });

    await repo.create({
      ownerId: 'user-1',
      resourceType: 'automation_rule',
      eventId: 'ev-1',
      name: 'Nova',
    });

    expect(findFirst.mock.calls[0][0].where).toEqual({
      resourceType: 'automation_rule',
      eventId: 'ev-1',
      parentId: null,
    });
  });
});

describe('PrismaFolderRepository.delete', () => {
  // A FK sozinha jogaria as subpastas na raiz (SET NULL); o contrato é promover
  // ao pai da pasta removida.
  it('promotes children to the removed folder parent inside one transaction', async () => {
    const updateMany = jest.fn().mockReturnValue('promote-op');
    const deleteFn = jest.fn().mockReturnValue('delete-op');
    const findUnique = jest.fn().mockResolvedValue({ parentId: 'grandparent' });
    const transaction = jest.fn().mockResolvedValue([]);
    const { repo } = await makeRepo(
      { updateMany, delete: deleteFn, findUnique },
      transaction,
    );

    await repo.delete('fld-1');

    expect(updateMany).toHaveBeenCalledWith({
      where: { parentId: 'fld-1' },
      data: { parentId: 'grandparent' },
    });
    expect(deleteFn).toHaveBeenCalledWith({ where: { id: 'fld-1' } });
    expect(transaction).toHaveBeenCalledWith(['promote-op', 'delete-op']);
  });

  it('promotes children to the root when the removed folder was a root', async () => {
    const updateMany = jest.fn().mockReturnValue('promote-op');
    const { repo } = await makeRepo(
      {
        updateMany,
        delete: jest.fn().mockReturnValue('delete-op'),
        findUnique: jest.fn().mockResolvedValue({ parentId: null }),
      },
      jest.fn().mockResolvedValue([]),
    );

    await repo.delete('fld-1');

    expect(updateMany).toHaveBeenCalledWith({
      where: { parentId: 'fld-1' },
      data: { parentId: null },
    });
  });
});

describe('PrismaFolderRepository.reorder', () => {
  it('writes the list index as order, scoped to the owner, in one transaction', async () => {
    const updateMany = jest.fn().mockImplementation((args) => args);
    const transaction = jest.fn().mockResolvedValue([]);
    const { repo } = await makeRepo({ updateMany }, transaction);

    await repo.reorder(PANEL, ['b', 'a']);

    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'b', resourceType: 'event', ownerId: 'user-1', eventId: null },
      data: { order: 0 },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'a', resourceType: 'event', ownerId: 'user-1', eventId: null },
      data: { order: 1 },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('scopes an event reorder to the event, not to the creator', async () => {
    const updateMany = jest.fn().mockImplementation((args) => args);
    const { repo } = await makeRepo({ updateMany }, jest.fn().mockResolvedValue([]));

    await repo.reorder(IN_EVENT, ['b']);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'b', resourceType: 'automation_rule', eventId: 'ev-1' },
      data: { order: 0 },
    });
  });
});
