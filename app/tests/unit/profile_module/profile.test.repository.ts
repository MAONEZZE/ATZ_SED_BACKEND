import { Test } from '@nestjs/testing';
import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaProfileRepository } from '@infra/repositories/profile_module/prisma-profile.repository';
import { ProfileEntity } from '@domain/profile_module/profile.entity';

const ROW = {
  id: 'p-1',
  userId: 'user-1',
  name: 'Alice',
  email: 'alice@x.test',
  photoUrl: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  role: 'team',
};

async function makeRepo(profile: Record<string, jest.Mock>) {
  const moduleRef = await Test.createTestingModule({
    providers: [PrismaProfileRepository, { provide: PrismaService, useValue: { profile } }],
  }).compile();
  return moduleRef.get(PrismaProfileRepository);
}

// Repositories extend PrismaRepositoryBase without declaring their own
// constructor. This test boots Nest DI (not manual `new`) to prove the base's
// PrismaService is actually injected — a plain unit test with `new Repo(mock)`
// would mask a broken injection. Regression for the POST /profile 500
// ("Cannot read properties of undefined (reading 'profile')").
describe('PrismaProfileRepository DI', () => {
  it('receives PrismaService through the inherited base constructor', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const repo = await makeRepo({ findUnique });

    await expect(repo.findByUserId('user-1')).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });
});

describe('PrismaProfileRepository mapping', () => {
  it('returns a ProfileEntity, not the raw row', async () => {
    const repo = await makeRepo({ findUnique: jest.fn().mockResolvedValue(ROW) });

    const profile = await repo.findByUserId('user-1');

    expect(profile).toBeInstanceOf(ProfileEntity);
    expect(profile!.id).toBe('p-1');
    expect(profile!.userId).toBe('user-1');
    expect(profile!.hasPhoto()).toBe(false);
    expect(profile!.isTeam()).toBe(true);
  });

  it('maps findByEmail through the same entity', async () => {
    const repo = await makeRepo({
      findFirst: jest.fn().mockResolvedValue({ ...ROW, photoUrl: 'https://x.test/p.png' }),
    });

    const profile = await repo.findByEmail('alice@x.test');

    expect(profile).toBeInstanceOf(ProfileEntity);
    expect(profile!.hasPhoto()).toBe(true);
  });

  it('maps role user to a non-team entity', async () => {
    const repo = await makeRepo({
      findUnique: jest.fn().mockResolvedValue({ ...ROW, role: 'user' }),
    });

    const profile = await repo.findByUserId('user-1');

    expect(profile!.isTeam()).toBe(false);
  });
});

// UpdateProfileData is all-optional, so an absent key must not reach Prisma or
// a partial PATCH would wipe columns the caller never sent. This filtering used
// to live in ProfileService and moved here with the port.
describe('PrismaProfileRepository.update', () => {
  it('forwards only the keys present on the input', async () => {
    const update = jest.fn().mockResolvedValue(ROW);
    const repo = await makeRepo({ update });

    await repo.update('user-1', { name: 'Bob' });

    expect(update).toHaveBeenCalledWith({ where: { userId: 'user-1' }, data: { name: 'Bob' } });
  });

  // Removing a photo is `photoUrl: null`, which a truthiness filter would drop.
  it('forwards an explicit null photoUrl instead of dropping it', async () => {
    const update = jest.fn().mockResolvedValue(ROW);
    const repo = await makeRepo({ update });

    await repo.update('user-1', { photoUrl: null });

    expect(update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { photoUrl: null },
    });
  });

  it('sends an empty payload when the input carries no keys', async () => {
    const update = jest.fn().mockResolvedValue(ROW);
    const repo = await makeRepo({ update });

    await repo.update('user-1', {});

    expect(update).toHaveBeenCalledWith({ where: { userId: 'user-1' }, data: {} });
  });

  // role isn't a key of UpdateProfileData, but the filter guards against a
  // caller that bypasses the type — no path may promote a profile via PATCH.
  it('never forwards role even when the input carries it', async () => {
    const update = jest.fn().mockResolvedValue(ROW);
    const repo = await makeRepo({ update });

    await repo.update('user-1', { name: 'Bob', role: 'team' } as unknown as { name: string });

    expect(update).toHaveBeenCalledWith({ where: { userId: 'user-1' }, data: { name: 'Bob' } });
  });
});
