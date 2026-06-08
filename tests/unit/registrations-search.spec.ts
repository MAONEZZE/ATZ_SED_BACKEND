import { PrismaRegistrationRepository } from '../../app/database/registrations/prisma-registration.repository';

function makeRepo() {
  const prisma = {
    registration: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  return { repo: new PrismaRegistrationRepository(prisma as any), prisma };
}

describe('PrismaRegistrationRepository.findAllByEvent search', () => {
  beforeEach(() => jest.clearAllMocks());

  it('combines status AND case-insensitive search across name/email/phone', async () => {
    const { repo, prisma } = makeRepo();
    await repo.findAllByEvent('evt-1', 'pending', 'joao');
    expect(prisma.registration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          eventId: 'evt-1',
          status: 'pending',
          OR: [
            { name: { contains: 'joao', mode: 'insensitive' } },
            { email: { contains: 'joao', mode: 'insensitive' } },
            { phone: { contains: 'joao', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });

  it('omits OR clause when no search given', async () => {
    const { repo, prisma } = makeRepo();
    await repo.findAllByEvent('evt-1');
    expect(prisma.registration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: 'evt-1' } }),
    );
  });
});
