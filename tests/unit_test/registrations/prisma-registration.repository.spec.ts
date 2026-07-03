import { Test } from '@nestjs/testing';
import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaRegistrationRepository } from '@modules/registrations/prisma-registration.repository';

// Boots Nest DI (not `new Repo(mock)`) to prove the inherited
// PrismaRepositoryBase constructor injects PrismaService. See profile.repository
// spec for the underlying design:paramtypes gotcha.
describe('PrismaRegistrationRepository DI', () => {
  it('injects PrismaService through the inherited base constructor', async () => {
    const prismaMock = {} as PrismaService;
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaRegistrationRepository, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    const repo = moduleRef.get(PrismaRegistrationRepository);
    expect((repo as unknown as { prisma: unknown }).prisma).toBe(prismaMock);
  });
});
