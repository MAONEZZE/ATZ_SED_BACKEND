import { ConflictException, NotFoundException } from '@nestjs/common';
import { CollaboratorService } from '@application/collaborator_module/collaborator.service';

function makeService() {
  const eventRepo = { findById: jest.fn() };
  const collaborators = {
    list: jest.fn(),
    upsert: jest.fn(),
    remove: jest.fn(),
  };
  const profiles = { findByEmail: jest.fn() };
  const service = new CollaboratorService(eventRepo as any, collaborators as any, profiles as any);
  return { service, eventRepo, collaborators, profiles };
}

describe('CollaboratorService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('list', () => {
    it('returns collaborators with joined profile fields', async () => {
      const { service, collaborators } = makeService();
      const rows = [
        {
          id: 'c1',
          profileId: 'p2',
          createdAt: new Date(),
          profile: { id: 'p2', name: 'Bob', email: 'bob@x.com', photoUrl: null },
        },
      ];
      collaborators.list.mockResolvedValue(rows);
      const result = await service.list('e1');
      expect(result).toBe(rows);
      expect(collaborators.list).toHaveBeenCalledWith('e1');
    });
  });

  describe('add', () => {
    it('adds a collaborator by email', async () => {
      const { service, eventRepo, profiles, collaborators } = makeService();
      eventRepo.findById.mockResolvedValue({ id: 'e1', ownerId: 'owner-1' });
      profiles.findByEmail.mockResolvedValue({ id: 'p2', email: 'bob@x.com' });
      collaborators.upsert.mockResolvedValue({ id: 'c1', eventId: 'e1', profileId: 'p2' });
      const result = await service.add('e1', 'bob@x.com');
      expect(result).toEqual(expect.objectContaining({ profileId: 'p2' }));
      expect(collaborators.upsert).toHaveBeenCalledWith('e1', 'p2');
    });

    it('throws NotFound when no registered user has that email', async () => {
      const { service, eventRepo, profiles, collaborators } = makeService();
      eventRepo.findById.mockResolvedValue({ id: 'e1', ownerId: 'owner-1' });
      profiles.findByEmail.mockResolvedValue(null);
      await expect(service.add('e1', 'ghost@x.com')).rejects.toThrow(NotFoundException);
      expect(collaborators.upsert).not.toHaveBeenCalled();
    });

    it('throws NotFound when event does not exist', async () => {
      const { service, eventRepo } = makeService();
      eventRepo.findById.mockResolvedValue(null);
      await expect(service.add('eX', 'bob@x.com')).rejects.toThrow(NotFoundException);
    });

    it('throws Conflict when the email belongs to the event owner', async () => {
      const { service, eventRepo, profiles, collaborators } = makeService();
      eventRepo.findById.mockResolvedValue({ id: 'e1', ownerId: 'owner-1' });
      profiles.findByEmail.mockResolvedValue({ id: 'owner-1', email: 'owner@x.com' });
      await expect(service.add('e1', 'owner@x.com')).rejects.toThrow(ConflictException);
      expect(collaborators.upsert).not.toHaveBeenCalled();
    });

    it('is idempotent when collaborator already exists (upsert, no error)', async () => {
      const { service, eventRepo, profiles, collaborators } = makeService();
      eventRepo.findById.mockResolvedValue({ id: 'e1', ownerId: 'owner-1' });
      profiles.findByEmail.mockResolvedValue({ id: 'p2', email: 'bob@x.com' });
      collaborators.upsert.mockResolvedValue({ id: 'c1', eventId: 'e1', profileId: 'p2' });
      await expect(service.add('e1', 'bob@x.com')).resolves.toBeDefined();
      expect(collaborators.upsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('removes an existing collaborator', async () => {
      const { service, collaborators } = makeService();
      collaborators.remove.mockResolvedValue(1);
      await expect(service.remove('e1', 'p2')).resolves.toBeUndefined();
      expect(collaborators.remove).toHaveBeenCalledWith('e1', 'p2');
    });

    it('throws NotFound when collaborator does not exist', async () => {
      const { service, collaborators } = makeService();
      collaborators.remove.mockResolvedValue(0);
      await expect(service.remove('e1', 'ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
