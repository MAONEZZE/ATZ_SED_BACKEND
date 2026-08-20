import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaEventRepository } from '@infra/repositories/event_module/prisma-event.repository';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    ownerId: 'user-1',
    title: 'Festa',
    slug: 'festa-abc',
    status: 'draft',
    coverUrl: null,
    location: null,
    capacity: null,
    dressCode: null,
    groupLink: null,
    eventDate: null,
    endDate: null,
    sendToPipedrive: false,
    whatsappInstanceId: null,
    whatsappToken: null,
    lastEditedById: null,
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
    recurrenceFreq: null,
    recurrenceInterval: null,
    recurrenceUntil: null,
    folderId: null,
    order: 0,
    collaborators: [],
    ...overrides,
  };
}

function listRepo(rows: Array<Record<string, unknown>>) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const count = jest.fn().mockResolvedValue(rows.length);
  const prisma = { event: { findMany, count } } as unknown as PrismaService;
  return { repo: new PrismaEventRepository(prisma), findMany };
}

describe('PrismaEventRepository.findAllByOwnerPaginated myRole', () => {
  it("marks the owner's own events as admin", async () => {
    const { repo } = listRepo([row({ ownerId: 'user-1' })]);

    const { data } = await repo.findAllByOwnerPaginated('user-1', { skip: 0, take: 20 });

    expect(data[0].myRole).toBe('admin');
  });

  it("uses the collaborator's stored role on someone else's event", async () => {
    const { repo } = listRepo([
      row({ ownerId: 'other-user', collaborators: [{ role: 'invited' }] }),
    ]);

    const { data } = await repo.findAllByOwnerPaginated('user-1', { skip: 0, take: 20 });

    expect(data[0].myRole).toBe('invited');
  });

  // Não deve acontecer (a lista só traz evento acessível), mas o default tem de
  // ser o papel mais fraco: nunca inventar 'admin' por ausência de dado.
  it('falls back to read when no link is joined', async () => {
    const { repo } = listRepo([row({ ownerId: 'other-user', collaborators: [] })]);

    const { data } = await repo.findAllByOwnerPaginated('user-1', { skip: 0, take: 20 });

    expect(data[0].myRole).toBe('read');
  });

  // O join tem de ser filtrado pelo próprio usuário: sem o where, o primeiro
  // colaborador qualquer viraria o papel de quem consultou.
  it('joins only the requesting profile collaborator row', async () => {
    const { repo, findMany } = listRepo([]);

    await repo.findAllByOwnerPaginated('user-1', { skip: 0, take: 20 });

    const [{ include }] = findMany.mock.calls[0] as [{ include: Record<string, any> }];
    expect(include.collaborators).toEqual({
      where: { profileId: 'user-1' },
      select: { role: true },
    });
  });

  it('keeps the entity behaviour alongside myRole', async () => {
    const { repo } = listRepo([row({ status: 'cancelled' })]);

    const { data } = await repo.findAllByOwnerPaginated('user-1', { skip: 0, take: 20 });

    expect(data[0].isEditable()).toBe(false);
    expect(data[0].title).toBe('Festa');
  });
});
