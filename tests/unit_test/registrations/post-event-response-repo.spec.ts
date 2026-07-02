import { PrismaRegistrationRepository } from '@modules/registrations/prisma-registration.repository';

function makeRepo() {
  const prisma = {
    registration: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    postEventResponse: { upsert: jest.fn().mockResolvedValue({}) },
  };
  return { repo: new PrismaRegistrationRepository(prisma as any), prisma };
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    eventId: 'evt-1',
    status: 'approved',
    answers: { q: 'a' },
    name: 'Alice',
    email: 'a@b.com',
    phone: '(11) 99999-8888',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

describe('PrismaRegistrationRepository post-event', () => {
  beforeEach(() => jest.clearAllMocks());

  it('finds by email via findFirst (case-insensitive) and maps the entity', async () => {
    const { repo, prisma } = makeRepo();
    const row = makeRow();
    prisma.registration.findFirst.mockResolvedValue(row);

    const result = await repo.findByEventAndContact('evt-1', { email: 'a@b.com' });

    expect(prisma.registration.findFirst).toHaveBeenCalledWith({
      where: {
        eventId: 'evt-1',
        email: { equals: 'a@b.com', mode: 'insensitive' },
      },
    });
    expect(prisma.registration.findMany).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result!.id).toBe('r1');
    expect(result!.eventId).toBe('evt-1');
    expect(result!.status).toBe('approved');
    expect(result!.answers).toEqual({ q: 'a' });
    expect(result!.name).toBe('Alice');
    expect(result!.email).toBe('a@b.com');
    expect(result!.phone).toBe('(11) 99999-8888');
    expect(result!.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(result!.updatedAt).toEqual(new Date('2026-01-02T00:00:00.000Z'));
  });

  it('finds by phone matching digits-only against stored formatted phone', async () => {
    const { repo, prisma } = makeRepo();
    const nonMatch = makeRow({ id: 'r0', phone: '(21) 12345-6789' });
    const match = makeRow({ id: 'r1', phone: '(11) 99999-8888' });
    prisma.registration.findMany.mockResolvedValue([nonMatch, match]);

    const result = await repo.findByEventAndContact('evt-1', {
      phone: '11999998888',
    });

    expect(prisma.registration.findMany).toHaveBeenCalledWith({
      where: { eventId: 'evt-1' },
    });
    expect(prisma.registration.findFirst).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result!.id).toBe('r1');
    expect(result!.phone).toBe('(11) 99999-8888');
  });

  it('returns the first registration when two stored phones strip to the same digits', async () => {
    const { repo, prisma } = makeRepo();
    const first = makeRow({ id: 'first', phone: '(11) 99999-8888' });
    const second = makeRow({ id: 'second', phone: '+55 11 99999 8888' });
    prisma.registration.findMany.mockResolvedValue([first, second]);

    const result = await repo.findByEventAndContact('evt-1', {
      phone: '11999998888',
    });

    expect(result).not.toBeNull();
    expect(result!.id).toBe('first');
  });

  it('returns null when no stored phone matches the queried digits', async () => {
    const { repo, prisma } = makeRepo();
    prisma.registration.findMany.mockResolvedValue([
      makeRow({ id: 'r0', phone: '(21) 12345-6789' }),
    ]);

    const result = await repo.findByEventAndContact('evt-1', {
      phone: '11999998888',
    });

    expect(prisma.registration.findMany).toHaveBeenCalledWith({
      where: { eventId: 'evt-1' },
    });
    expect(result).toBeNull();
  });

  it('returns null and does not query when phone has no digits', async () => {
    const { repo, prisma } = makeRepo();

    const result = await repo.findByEventAndContact('evt-1', { phone: '' });

    expect(result).toBeNull();
    expect(prisma.registration.findMany).not.toHaveBeenCalled();
    expect(prisma.registration.findFirst).not.toHaveBeenCalled();
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
