import { NotFoundException } from '@nestjs/common';
import { EventService } from '@application/event_module/event.service';
import { EventEntity } from '@domain/event_module/event.entity';

const existing = new EventEntity('evt-1', 'owner-1', 'Tech Day', 'tech-day-abc', 'draft');

/** Pasta que serve para evento: do editor, tipo `event`, e fora de qualquer evento. */
const PANEL_FOLDER = {
  id: 'fld-1',
  ownerId: 'user-1',
  resourceType: 'event' as const,
  eventId: null,
};

function makeService(folder: unknown = PANEL_FOLDER) {
  const eventRepo = {
    findById: jest.fn().mockResolvedValue(existing),
    findAllByOwnerPaginated: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    update: jest.fn().mockImplementation((_id, data) => Promise.resolve(data)),
    reorder: jest.fn().mockResolvedValue(undefined),
  };
  const folders = { findById: jest.fn().mockResolvedValue(folder) };
  const storage = { upload: jest.fn(), delete: jest.fn(), getPublicUrl: jest.fn() };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const whatsappInstances = { isAllowedForProfile: jest.fn().mockResolvedValue(true) };
  const collaborators = { remove: jest.fn().mockResolvedValue(1) };
  const service = new EventService(
    eventRepo as any,
    collaborators as any,
    folders as any,
    whatsappInstances as any,
    storage,
    config as any,
  );
  return { service, collaborators, eventRepo, folders, whatsappInstances };
}

describe('EventService folder scope', () => {
  it('forwards the folder scope to the repository', async () => {
    const { service, eventRepo } = makeService();

    await service.findAllPaginated('user-1', 2, 10, null);

    expect(eventRepo.findAllByOwnerPaginated).toHaveBeenCalledWith(
      'user-1',
      { skip: 10, take: 10 },
      null,
    );
  });

  it('omits the folder scope when not given', async () => {
    const { service, eventRepo } = makeService();

    await service.findAllPaginated('user-1', 1, 20);

    expect(eventRepo.findAllByOwnerPaginated).toHaveBeenCalledWith(
      'user-1',
      { skip: 0, take: 20 },
      undefined,
    );
  });
});

describe('EventService.update folderId', () => {
  // Pasta é organização pessoal: sem essa checagem um id conhecido moveria o
  // evento para dentro da pasta de outra conta.
  it('rejects a folder that does not exist', async () => {
    const { service, eventRepo } = makeService(null);

    await expect(service.update('evt-1', { folderId: 'fld-outra' }, 'user-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(eventRepo.update).not.toHaveBeenCalled();
  });

  it('rejects a folder of another owner', async () => {
    const { service, eventRepo } = makeService({ ...PANEL_FOLDER, ownerId: 'user-2' });

    await expect(service.update('evt-1', { folderId: 'fld-1' }, 'user-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(eventRepo.update).not.toHaveBeenCalled();
  });

  // Folder é genérico: pasta de template/automação não organiza evento.
  it('rejects a folder of another resource type', async () => {
    const { service, eventRepo } = makeService({
      ...PANEL_FOLDER,
      resourceType: 'message_template',
    });

    await expect(service.update('evt-1', { folderId: 'fld-1' }, 'user-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(eventRepo.update).not.toHaveBeenCalled();
  });

  it('rejects a folder that lives inside an event', async () => {
    const { service, eventRepo } = makeService({ ...PANEL_FOLDER, eventId: 'ev-9' });

    await expect(service.update('evt-1', { folderId: 'fld-1' }, 'user-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(eventRepo.update).not.toHaveBeenCalled();
  });

  it('accepts a panel folder of the editor', async () => {
    const { service, eventRepo, folders } = makeService();

    await service.update('evt-1', { folderId: 'fld-1' }, 'user-1');

    expect(folders.findById).toHaveBeenCalledWith('fld-1');
    expect(eventRepo.update).toHaveBeenCalledWith(
      'evt-1',
      expect.objectContaining({ folderId: 'fld-1' }),
    );
  });

  it('does not look up a folder when clearing it with null', async () => {
    const { service, eventRepo, folders } = makeService();

    await service.update('evt-1', { folderId: null }, 'user-1');

    expect(folders.findById).not.toHaveBeenCalled();
    expect(eventRepo.update).toHaveBeenCalledWith(
      'evt-1',
      expect.objectContaining({ folderId: null }),
    );
  });
});

describe('EventService.reorder', () => {
  it('passes the scope through to the repository', async () => {
    const { service, eventRepo } = makeService();

    await service.reorder('user-1', 'fld-1', ['e2', 'e1']);

    expect(eventRepo.reorder).toHaveBeenCalledWith('user-1', 'fld-1', ['e2', 'e1']);
  });
});
