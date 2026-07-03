import { Test } from '@nestjs/testing';
import { PrismaService } from '@infra/prisma/prisma.service';
import { PostEventResponsesRepository } from '@modules/registrations/post-event-responses.repository';

// Boots Nest DI (not `new Repo(mock)`) to prove the inherited
// PrismaRepositoryBase constructor injects PrismaService. See profile.repository
// spec for the underlying design:paramtypes gotcha.
describe('PostEventResponsesRepository DI', () => {
  it('injects PrismaService through the inherited base constructor', async () => {
    const prismaMock = {} as PrismaService;
    const moduleRef = await Test.createTestingModule({
      providers: [PostEventResponsesRepository, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    const repo = moduleRef.get(PostEventResponsesRepository);
    expect((repo as unknown as { prisma: unknown }).prisma).toBe(prismaMock);
  });
});
