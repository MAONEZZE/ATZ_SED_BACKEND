import { PrismaRegistrationRepository } from '../../app/database/registrations/prisma-registration.repository';

function makeRepo() {
  const prisma = {
    registration: { findFirst: jest.fn().mockResolvedValue(null) },
    postEventResponse: { upsert: jest.fn().mockResolvedValue({}) },
  };
  return { repo: new PrismaRegistrationRepository(prisma as any), prisma };
}

describe('PrismaRegistrationRepository post-event', () => {
  beforeEach(() => jest.clearAllMocks());

  it('finds by email OR phone within the event', async () => {
    const { repo, prisma } = makeRepo();
    await repo.findByEventAndContact('evt-1', { email: 'a@b.com', phone: '5511' });
    expect(prisma.registration.findFirst).toHaveBeenCalledWith({
      where: {
        eventId: 'evt-1',
        OR: [
          { email: { equals: 'a@b.com', mode: 'insensitive' } },
          { phone: { contains: '5511' } },
        ],
      },
    });
  });

  it('omits email clause when only phone given', async () => {
    const { repo, prisma } = makeRepo();
    await repo.findByEventAndContact('evt-1', { phone: '5511' });
    expect(prisma.registration.findFirst).toHaveBeenCalledWith({
      where: { eventId: 'evt-1', OR: [{ phone: { contains: '5511' } }] },
    });
  });

  it('upserts the post-event response keyed by registrationId', async () => {
    const { repo, prisma } = makeRepo();
    await repo.upsertPostEventResponse({
      eventId: 'evt-1',
      registrationId: 'r1',
      answers: { q: 'a' },
    });
    expect(prisma.postEventResponse.upsert).toHaveBeenCalledWith({
      where: { registrationId: 'r1' },
      create: { eventId: 'evt-1', registrationId: 'r1', answers: { q: 'a' } },
      update: { answers: { q: 'a' } },
    });
  });
});
