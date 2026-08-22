import { ForbiddenException } from '@nestjs/common';
import { EventService } from '@application/event_module/event.service';
import { EventEntity } from '@domain/event_module/event.entity';

const existing = new EventEntity('evt-1', 'owner-1', 'Tech Day', 'tech-day-abc', 'draft');

function makeService(ownership: { ownerId: string; role: string | null } | null) {
  const eventRepo = {
    findById: jest.fn().mockResolvedValue(existing),
    findOwnershipById: jest
      .fn()
      .mockResolvedValue(
        ownership && { ...ownership, isCollaborator: ownership.ownerId !== 'user-1' },
      ),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const collaborators = { remove: jest.fn().mockResolvedValue(1) };
  const folders = { findByIdForOwner: jest.fn() };
  const whatsappInstances = { isAllowedForProfile: jest.fn().mockResolvedValue(true) };
  const storage = { upload: jest.fn(), delete: jest.fn(), getPublicUrl: jest.fn() };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const service = new EventService(
    eventRepo as any,
    collaborators as any,
    folders as any,
    whatsappInstances as any,
    storage,
    config as any,
  );
  return { service, eventRepo, collaborators };
}

// DELETE bifurca pelo papel: dono e admin apagam; invited e read só saem do
// evento compartilhado, que continua vivo para os outros.
describe('EventService.delete por papel', () => {
  it('owner deletes the event', async () => {
    const { service, eventRepo, collaborators } = makeService({ ownerId: 'user-1', role: 'admin' });

    await expect(service.delete('evt-1', 'user-1')).resolves.toEqual({ deleted: true });
    expect(eventRepo.delete).toHaveBeenCalledWith('evt-1');
    expect(collaborators.remove).not.toHaveBeenCalled();
  });

  it('admin collaborator deletes the event', async () => {
    const { service, eventRepo } = makeService({ ownerId: 'owner-1', role: 'admin' });

    await expect(service.delete('evt-1', 'user-1')).resolves.toEqual({ deleted: true });
    expect(eventRepo.delete).toHaveBeenCalledWith('evt-1');
  });

  it('invited only unlinks itself', async () => {
    const { service, eventRepo, collaborators } = makeService({
      ownerId: 'owner-1',
      role: 'invited',
    });

    await expect(service.delete('evt-1', 'user-1')).resolves.toEqual({ deleted: false });
    expect(eventRepo.delete).not.toHaveBeenCalled();
    expect(collaborators.remove).toHaveBeenCalledWith('evt-1', 'user-1');
  });

  it('read only unlinks itself', async () => {
    const { service, eventRepo, collaborators } = makeService({ ownerId: 'owner-1', role: 'read' });

    await expect(service.delete('evt-1', 'user-1')).resolves.toEqual({ deleted: false });
    expect(eventRepo.delete).not.toHaveBeenCalled();
    expect(collaborators.remove).toHaveBeenCalledWith('evt-1', 'user-1');
  });

  it('403s someone with no role', async () => {
    const { service, eventRepo, collaborators } = makeService({ ownerId: 'owner-1', role: null });

    await expect(service.delete('evt-1', 'user-1')).rejects.toThrow(ForbiddenException);
    expect(eventRepo.delete).not.toHaveBeenCalled();
    expect(collaborators.remove).not.toHaveBeenCalled();
  });
});
