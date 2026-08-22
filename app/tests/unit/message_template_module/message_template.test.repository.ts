import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaMessageTemplateRepository } from '@infra/repositories/message_template_module/prisma-message-template.repository';
import { MessageTemplateEntity } from '@domain/message_template_module/message-template.entity';

const ROW = {
  id: 'tpl-1',
  ownerId: 'owner-1',
  name: 'Boas-vindas',
  channel: 'email',
  subject: 'Olá',
  body: 'Corpo',
  layoutConfig: { blocks: [] },
  styleKey: null,
  eventId: null,
  createdAt: new Date('2026-03-01'),
  updatedAt: new Date('2026-03-02'),
};

async function makeRepo(messageTemplate: Record<string, jest.Mock> = {}, event = {}) {
  const prismaMock = { messageTemplate, event } as unknown as PrismaService;
  const moduleRef = await Test.createTestingModule({
    providers: [PrismaMessageTemplateRepository, { provide: PrismaService, useValue: prismaMock }],
  }).compile();
  return { repo: moduleRef.get(PrismaMessageTemplateRepository), prismaMock };
}

// Boots Nest DI (not `new Repo(mock)`) to prove the inherited
// PrismaRepositoryBase constructor injects PrismaService.
describe('PrismaMessageTemplateRepository DI', () => {
  it('injects PrismaService through the inherited base constructor', async () => {
    const { repo, prismaMock } = await makeRepo();
    expect((repo as unknown as { prisma: unknown }).prisma).toBe(prismaMock);
  });
});

describe('PrismaMessageTemplateRepository mapping', () => {
  it('returns a MessageTemplateEntity', async () => {
    const { repo } = await makeRepo({ findFirst: jest.fn().mockResolvedValue(ROW) });

    const template = await repo.findByIdForUser('tpl-1', 'owner-1');

    expect(template).toBeInstanceOf(MessageTemplateEntity);
    expect(template!.isGlobal()).toBe(true);
  });

  it('normalises a JSON-null layoutConfig to null', async () => {
    const { repo } = await makeRepo({
      findFirst: jest.fn().mockResolvedValue({ ...ROW, layoutConfig: null }),
    });

    const template = await repo.findByIdForUser('tpl-1', 'owner-1');

    expect(template!.layoutConfig).toBeNull();
  });
});

// The filter used to be a Prisma.MessageTemplateWhereInput built by the
// service. It is now semantic, and the repository translates it — including the
// three-way meaning of eventId.
describe('PrismaMessageTemplateRepository.findAllForOwnerPaginated filter', () => {
  async function listWith(
    filter: Parameters<PrismaMessageTemplateRepository['findAllForOwnerPaginated']>[1],
  ) {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const { repo } = await makeRepo({ findMany, count });
    await repo.findAllForOwnerPaginated('owner-1', filter, { skip: 0, take: 20 });
    const [{ where }] = findMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    return where;
  }

  it('always scopes to the owner', async () => {
    expect(await listWith({})).toEqual({ ownerId: 'owner-1' });
  });

  it('an absent eventId means no event filter at all', async () => {
    const where = await listWith({ channel: 'email' });
    expect(where).not.toHaveProperty('eventId');
    expect(where.channel).toBe('email');
  });

  // 'null' is how the query string asks for global templates only; dropping it
  // would silently widen the list to every template of the owner.
  it('an explicit null eventId filters to global templates', async () => {
    expect(await listWith({ eventId: null })).toEqual({ ownerId: 'owner-1', eventId: null });
  });

  // Dentro do evento a lista é "os do evento + os globais do dono": o template do
  // evento pode ser de outro dono (colaborador), e o global segue reutilizável.
  it('a string eventId returns the event templates plus the owner globals', async () => {
    expect(await listWith({ eventId: 'evt-1' })).toEqual({
      OR: [{ eventId: 'evt-1' }, { ownerId: 'owner-1', eventId: null }],
    });
  });

  it('keeps the channel filter alongside the event scope', async () => {
    const where = await listWith({ eventId: 'evt-1', channel: 'whatsapp' });
    expect(where.channel).toBe('whatsapp');
    expect(where.OR).toHaveLength(2);
  });
});

describe('PrismaMessageTemplateRepository.findByIdForUser', () => {
  it('accepts the template owner or anyone with access to its event', async () => {
    const findFirst = jest.fn().mockResolvedValue(ROW);
    const { repo } = await makeRepo({ findFirst });

    await repo.findByIdForUser('tpl-1', 'user-1');

    const [{ where }] = findFirst.mock.calls[0] as [{ where: { id: string; OR: unknown[] } }];
    expect(where.id).toBe('tpl-1');
    expect(where.OR).toEqual([
      { ownerId: 'user-1' },
      {
        event: {
          OR: [{ ownerId: 'user-1' }, { collaborators: { some: { profileId: 'user-1' } } }],
        },
      },
    ]);
  });
});

describe('PrismaMessageTemplateRepository.update', () => {
  it('forwards only the keys present on the input', async () => {
    const update = jest.fn().mockResolvedValue(ROW);
    const { repo } = await makeRepo({ update });

    await repo.update('tpl-1', { name: 'Novo nome' });

    expect(update).toHaveBeenCalledWith({ where: { id: 'tpl-1' }, data: { name: 'Novo nome' } });
  });

  // Unlinking a template from its event is an explicit null.
  it('forwards an explicit null eventId', async () => {
    const update = jest.fn().mockResolvedValue(ROW);
    const { repo } = await makeRepo({ update });

    await repo.update('tpl-1', { eventId: null });

    expect(update).toHaveBeenCalledWith({ where: { id: 'tpl-1' }, data: { eventId: null } });
  });

  it('writes Prisma.JsonNull when layoutConfig is cleared', async () => {
    const update = jest.fn().mockResolvedValue(ROW);
    const { repo } = await makeRepo({ update });

    await repo.update('tpl-1', { layoutConfig: null });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'tpl-1' },
      data: { layoutConfig: Prisma.JsonNull },
    });
  });
});

describe('PrismaMessageTemplateRepository.eventAccessible', () => {
  it('returns true when the event is reachable by the user', async () => {
    const { repo } = await makeRepo(
      {},
      { findFirst: jest.fn().mockResolvedValue({ id: 'evt-1' }) },
    );
    await expect(repo.eventAccessible('evt-1', 'user-1')).resolves.toBe(true);
  });

  it('returns false instead of null when it is not', async () => {
    const { repo } = await makeRepo({}, { findFirst: jest.fn().mockResolvedValue(null) });
    await expect(repo.eventAccessible('evt-1', 'user-1')).resolves.toBe(false);
  });
});
