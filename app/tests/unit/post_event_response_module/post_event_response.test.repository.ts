import { Test } from '@nestjs/testing';
import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaPostEventResponseRepository } from '@infra/repositories/post_event_response_module/prisma-post-event-response.repository';
import { PostEventResponseEntity } from '@domain/post_event_response_module/post-event-response.entity';

async function makeRepo(postEventResponse: Record<string, jest.Mock> = {}) {
  const prismaMock = { postEventResponse } as unknown as PrismaService;
  const moduleRef = await Test.createTestingModule({
    providers: [
      PrismaPostEventResponseRepository,
      { provide: PrismaService, useValue: prismaMock },
    ],
  }).compile();
  return { repo: moduleRef.get(PrismaPostEventResponseRepository), prismaMock };
}

// Boots Nest DI (not `new Repo(mock)`) to prove the inherited
// PrismaRepositoryBase constructor injects PrismaService. See profile.repository
// spec for the underlying design:paramtypes gotcha.
describe('PrismaPostEventResponseRepository DI', () => {
  it('injects PrismaService through the inherited base constructor', async () => {
    const { repo, prismaMock } = await makeRepo();
    expect((repo as unknown as { prisma: unknown }).prisma).toBe(prismaMock);
  });
});

describe('PrismaPostEventResponseRepository.findAllByEvent', () => {
  const ROW = {
    id: 'per-1',
    eventId: 'evt-1',
    registrationId: 'reg-1',
    answers: { nota: 10 },
    createdAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-02'),
    registration: { name: 'Alice', email: 'a@x.test', phone: '5511999999999' },
  };

  it('splits the joined row into an entity and the respondent contact', async () => {
    const { repo } = await makeRepo({ findMany: jest.fn().mockResolvedValue([ROW]) });

    const [item] = await repo.findAllByEvent('evt-1');

    expect(item.response).toBeInstanceOf(PostEventResponseEntity);
    expect(item.response.id).toBe('per-1');
    expect(item.response.registrationId).toBe('reg-1');
    expect(item.respondent).toEqual({
      name: 'Alice',
      email: 'a@x.test',
      phone: '5511999999999',
    });
  });

  // `answers` is a Json column: it arrives as unknown and may be null when the
  // response was stored without a payload. The CSV export assumes an object.
  it('normalises a null answers column to an empty object', async () => {
    const { repo } = await makeRepo({
      findMany: jest.fn().mockResolvedValue([{ ...ROW, answers: null }]),
    });

    const [item] = await repo.findAllByEvent('evt-1');

    expect(item.response.answers).toEqual({});
  });

  it('keeps the stored answers when present', async () => {
    const { repo } = await makeRepo({ findMany: jest.fn().mockResolvedValue([ROW]) });

    const [item] = await repo.findAllByEvent('evt-1');

    expect(item.response.answers).toEqual({ nota: 10 });
  });
});
