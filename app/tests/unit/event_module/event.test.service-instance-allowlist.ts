import { ForbiddenException } from '@nestjs/common';
import { EventService } from '@application/event_module/event.service';
import { EventEntity } from '@domain/event_module/event.entity';

const existing = new EventEntity('evt-1', 'owner-1', 'Tech Day', 'tech-day-abc', 'draft');

function makeService(instanceAllowed = true) {
  const eventRepo = {
    findById: jest.fn().mockResolvedValue(existing),
    update: jest.fn().mockImplementation((_id, data) => Promise.resolve(data)),
  };
  const folders = { findByIdForOwner: jest.fn().mockResolvedValue({ id: 'fld-1' }) };
  const whatsappInstances = {
    isAllowedForProfile: jest.fn().mockResolvedValue(instanceAllowed),
  };
  const storage = { upload: jest.fn(), delete: jest.fn(), getPublicUrl: jest.fn() };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const collaborators = { remove: jest.fn().mockResolvedValue(1) };
  const service = new EventService(
    eventRepo as any,
    collaborators as any,
    folders as any,
    whatsappInstances as any,
    storage,
    config as any,
  );
  return { service, collaborators, eventRepo, whatsappInstances };
}

// Vincular a instância ao evento é o outro caminho para disparar por ela, então
// obedece à mesma lista fixa (profile_whatsapp_instances) do envio manual.
describe('EventService.update whatsappInstanceId', () => {
  it('rejects an instance not released for the editor', async () => {
    const { service, eventRepo } = makeService(false);

    await expect(
      service.update('evt-1', { whatsappInstanceId: 'inst-1' }, 'user-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(eventRepo.update).not.toHaveBeenCalled();
  });

  it('accepts an instance in the editor list', async () => {
    const { service, eventRepo, whatsappInstances } = makeService(true);

    await service.update('evt-1', { whatsappInstanceId: 'inst-1' }, 'user-1');

    expect(whatsappInstances.isAllowedForProfile).toHaveBeenCalledWith('inst-1', 'user-1');
    expect(eventRepo.update).toHaveBeenCalledWith(
      'evt-1',
      expect.objectContaining({ whatsappInstanceId: 'inst-1' }),
    );
  });

  it('does not check anything when the patch has no instance', async () => {
    const { service, whatsappInstances } = makeService(true);

    await service.update('evt-1', { title: 'Novo' }, 'user-1');

    expect(whatsappInstances.isAllowedForProfile).not.toHaveBeenCalled();
  });
});
