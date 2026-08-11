import { Test } from '@nestjs/testing';
import { PrismaService } from '@infra/prisma/prisma.service';
import { MessageTemplatesRepository } from '@infra/repositories/message_template_module/message-templates.repository';

// Boots Nest DI (not `new Repo(mock)`) to prove the inherited
// PrismaRepositoryBase constructor injects PrismaService. See profile.repository
// spec for the underlying design:paramtypes gotcha.
describe('MessageTemplatesRepository DI', () => {
  it('injects PrismaService through the inherited base constructor', async () => {
    const prismaMock = {} as PrismaService;
    const moduleRef = await Test.createTestingModule({
      providers: [MessageTemplatesRepository, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    const repo = moduleRef.get(MessageTemplatesRepository);
    expect((repo as unknown as { prisma: unknown }).prisma).toBe(prismaMock);
  });
});
