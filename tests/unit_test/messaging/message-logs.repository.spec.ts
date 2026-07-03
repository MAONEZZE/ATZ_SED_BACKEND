import { Test } from '@nestjs/testing';
import { PrismaService } from '@infra/prisma/prisma.service';
import { MessageLogsRepository } from '@modules/messaging/message-logs.repository';

// Boots Nest DI (not `new Repo(mock)`) to prove the inherited
// PrismaRepositoryBase constructor injects PrismaService. See profile.repository
// spec for the underlying design:paramtypes gotcha.
describe('MessageLogsRepository DI', () => {
  it('injects PrismaService through the inherited base constructor', async () => {
    const prismaMock = {} as PrismaService;
    const moduleRef = await Test.createTestingModule({
      providers: [MessageLogsRepository, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    const repo = moduleRef.get(MessageLogsRepository);
    expect((repo as unknown as { prisma: unknown }).prisma).toBe(prismaMock);
  });
});
