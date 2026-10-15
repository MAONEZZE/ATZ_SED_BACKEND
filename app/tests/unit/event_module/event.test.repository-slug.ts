import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaEventRepository } from '@infra/repositories/event_module/prisma-event.repository';

const ROW = {
  id: 'evt-1',
  ownerId: 'owner-1',
  title: 'Evento',
  slug: 'meu-evento',
  status: 'draft',
};

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });

function makeRepo() {
  const create = jest.fn().mockResolvedValue(ROW);
  const update = jest.fn().mockResolvedValue(ROW);
  const prisma = { event: { create, update } } as unknown as PrismaService;
  return { repo: new PrismaEventRepository(prisma), create, update };
}

describe('PrismaEventRepository slug', () => {
  it('create uses an explicit slug literally', async () => {
    const { repo, create } = makeRepo();
    await repo.create({ ownerId: 'owner-1', title: 'Evento', slug: 'meu-evento' });
    expect(create).toHaveBeenCalledWith({
      data: { ownerId: 'owner-1', title: 'Evento', slug: 'meu-evento' },
    });
  });

  it('create with explicit slug turns P2002 into 409 without retrying', async () => {
    const { repo, create } = makeRepo();
    create.mockRejectedValue(uniqueViolation());
    await expect(
      repo.create({ ownerId: 'owner-1', title: 'Evento', slug: 'meu-evento' }),
    ).rejects.toThrow(ConflictException);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('create without slug still generates one from the title', async () => {
    const { repo, create } = makeRepo();
    await repo.create({ ownerId: 'owner-1', title: 'Meu Evento' });
    const [args] = create.mock.calls[0] as [{ data: { slug: string } }];
    expect(args.data.slug).toMatch(/^meu-evento-[0-9A-F]{6}$/);
  });

  it('update turns P2002 into 409', async () => {
    const { repo, update } = makeRepo();
    update.mockRejectedValue(uniqueViolation());
    await expect(repo.update('evt-1', { slug: 'outro' })).rejects.toThrow(ConflictException);
  });
});
