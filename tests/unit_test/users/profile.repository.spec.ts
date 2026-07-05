import { Test } from '@nestjs/testing';
import { PrismaService } from '@infra/prisma/prisma.service';
import { ProfileRepository } from '@modules/users/profile.repository';

// Repositories extend PrismaRepositoryBase without declaring their own
// constructor. This test boots Nest DI (not manual `new`) to prove the base's
// PrismaService is actually injected — a plain unit test with `new Repo(mock)`
// would mask a broken injection. Regression for the POST /profile 500
// ("Cannot read properties of undefined (reading 'profile')").
describe('ProfileRepository DI', () => {
  it('receives PrismaService through the inherited base constructor', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const prismaMock = { profile: { findUnique } };

    const moduleRef = await Test.createTestingModule({
      providers: [ProfileRepository, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    const repo = moduleRef.get(ProfileRepository);
    await expect(repo.findByUserId('user-1')).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });
});
