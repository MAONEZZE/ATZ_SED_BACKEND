import { ConflictException, NotFoundException } from '@nestjs/common';
import { CollaboratorsService } from '@modules/events/collaborators.service';

function makeService() {
  const prisma = {
    event: { findUnique: jest.fn() },
    profile: { findFirst: jest.fn() },
    eventCollaborator: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const service = new CollaboratorsService(prisma as any);
  return { service, prisma };
}

describe('CollaboratorsService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('list', () => {
    it('returns collaborators with joined profile fields', async () => {
      const { service, prisma } = makeService();
      const rows = [
        {
          id: 'c1',
          profileId: 'p2',
          createdAt: new Date(),
          profile: { id: 'p2', name: 'Bob', email: 'bob@x.com', photoUrl: null },
        },
      ];
      prisma.eventCollaborator.findMany.mockResolvedValue(rows);
      const result = await service.list('e1');
      expect(result).toBe(rows);
      expect(prisma.eventCollaborator.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventId: 'e1' },
          include: expect.objectContaining({ profile: expect.any(Object) }),
        }),
      );
    });
  });

  describe('add', () => {
    it('adds a collaborator by email', async () => {
      const { service, prisma } = makeService();
      prisma.event.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
      prisma.profile.findFirst.mockResolvedValue({ id: 'p2', email: 'bob@x.com' });
      prisma.eventCollaborator.upsert.mockResolvedValue({
        id: 'c1',
        eventId: 'e1',
        profileId: 'p2',
      });
      const result = await service.add('e1', 'bob@x.com');
      expect(result).toEqual(expect.objectContaining({ profileId: 'p2' }));
      expect(prisma.eventCollaborator.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventId_profileId: { eventId: 'e1', profileId: 'p2' } },
          create: { eventId: 'e1', profileId: 'p2' },
        }),
      );
    });

    it('throws NotFound when no registered user has that email', async () => {
      const { service, prisma } = makeService();
      prisma.event.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
      prisma.profile.findFirst.mockResolvedValue(null);
      await expect(service.add('e1', 'ghost@x.com')).rejects.toThrow(NotFoundException);
      expect(prisma.eventCollaborator.upsert).not.toHaveBeenCalled();
    });

    it('throws NotFound when event does not exist', async () => {
      const { service, prisma } = makeService();
      prisma.event.findUnique.mockResolvedValue(null);
      await expect(service.add('eX', 'bob@x.com')).rejects.toThrow(NotFoundException);
    });

    it('throws Conflict when the email belongs to the event owner', async () => {
      const { service, prisma } = makeService();
      prisma.event.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
      prisma.profile.findFirst.mockResolvedValue({ id: 'owner-1', email: 'owner@x.com' });
      await expect(service.add('e1', 'owner@x.com')).rejects.toThrow(ConflictException);
      expect(prisma.eventCollaborator.upsert).not.toHaveBeenCalled();
    });

    it('is idempotent when collaborator already exists (upsert, no error)', async () => {
      const { service, prisma } = makeService();
      prisma.event.findUnique.mockResolvedValue({ ownerId: 'owner-1' });
      prisma.profile.findFirst.mockResolvedValue({ id: 'p2', email: 'bob@x.com' });
      prisma.eventCollaborator.upsert.mockResolvedValue({
        id: 'c1',
        eventId: 'e1',
        profileId: 'p2',
      });
      await expect(service.add('e1', 'bob@x.com')).resolves.toBeDefined();
      expect(prisma.eventCollaborator.upsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('removes an existing collaborator', async () => {
      const { service, prisma } = makeService();
      prisma.eventCollaborator.deleteMany.mockResolvedValue({ count: 1 });
      await expect(service.remove('e1', 'p2')).resolves.toBeUndefined();
      expect(prisma.eventCollaborator.deleteMany).toHaveBeenCalledWith({
        where: { eventId: 'e1', profileId: 'p2' },
      });
    });

    it('throws NotFound when collaborator does not exist', async () => {
      const { service, prisma } = makeService();
      prisma.eventCollaborator.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.remove('e1', 'ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
