import { BadRequestException } from '@nestjs/common';
import { EventsService } from '@services/events/events.service';
import { EventEntity } from '@domain/events/entities/event.entity';

const existing = new EventEntity(
  'evt-1',
  'owner-1',
  'Tech Day',
  'tech-day-abc',
  'draft',
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  new Date('2026-06-15T18:00:00Z'),
);

function makeService() {
  const eventRepo = {
    findById: jest.fn().mockResolvedValue(existing),
    create: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    update: jest.fn().mockImplementation((_id, data) => Promise.resolve(data)),
    updateStatus: jest.fn().mockImplementation((_id, status) => Promise.resolve({ status })),
  };
  const storage = { upload: jest.fn(), delete: jest.fn() };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const service = new EventsService(eventRepo as any, storage, config as any);
  return { service, eventRepo, storage, config };
}

describe('EventsService endDate validation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('create rejects endDate before eventDate', async () => {
    const { service } = makeService();
    await expect(
      service.create('owner-1', {
        title: 'Evento',
        eventDate: new Date('2026-06-15T18:00:00Z'),
        endDate: new Date('2026-06-15T17:00:00Z'),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('create accepts endDate after eventDate', async () => {
    const { service, eventRepo } = makeService();
    await service.create('owner-1', {
      title: 'Evento',
      eventDate: new Date('2026-06-15T18:00:00Z'),
      endDate: new Date('2026-06-15T22:00:00Z'),
    });
    expect(eventRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        endDate: new Date('2026-06-15T22:00:00Z'),
      }),
    );
  });

  it('update validates endDate against existing eventDate when eventDate not in patch', async () => {
    const { service } = makeService();
    await expect(
      service.update('evt-1', { endDate: new Date('2026-06-15T17:00:00Z') }),
    ).rejects.toThrow(BadRequestException);
  });

  it('deleteCover removes file from storage and clears coverUrl', async () => {
    const { service, eventRepo, storage } = makeService();
    const withCover = new EventEntity(
      'evt-1',
      'owner-1',
      'Tech Day',
      'tech-day-abc',
      'draft',
      undefined,
      'https://storage/evt-1/cover',
    );
    eventRepo.findById.mockResolvedValue(withCover);
    await service.deleteCover('evt-1');
    expect(storage.delete).toHaveBeenCalledWith('ATZ_SED', 'event-covers/evt-1/cover');
    expect(eventRepo.update).toHaveBeenCalledWith('evt-1', { coverUrl: null });
  });

  it('deleteCover still clears coverUrl when storage delete fails', async () => {
    const { service, eventRepo, storage } = makeService();
    const withCover = new EventEntity(
      'evt-1',
      'owner-1',
      'Tech Day',
      'tech-day-abc',
      'draft',
      undefined,
      'https://storage/evt-1/cover',
    );
    eventRepo.findById.mockResolvedValue(withCover);
    storage.delete.mockRejectedValue(new Error('object not found'));
    await service.deleteCover('evt-1');
    expect(eventRepo.update).toHaveBeenCalledWith('evt-1', { coverUrl: null });
  });

  it('deleteCover skips storage when event has no cover', async () => {
    const { service, eventRepo, storage } = makeService();
    eventRepo.findById.mockResolvedValue(existing);
    await service.deleteCover('evt-1');
    expect(storage.delete).not.toHaveBeenCalled();
    expect(eventRepo.update).toHaveBeenCalledWith('evt-1', { coverUrl: null });
  });

  it('update accepts endDate after merged eventDate and passes postRegistrationMessage', async () => {
    const { service, eventRepo } = makeService();
    await service.update('evt-1', {
      endDate: new Date('2026-06-15T22:00:00Z'),
      postRegistrationMessage: 'Obrigado!',
    });
    expect(eventRepo.update).toHaveBeenCalledWith(
      'evt-1',
      expect.objectContaining({
        endDate: new Date('2026-06-15T22:00:00Z'),
        postRegistrationMessage: 'Obrigado!',
      }),
    );
  });

  it('update stamps lastEditedById when editor provided', async () => {
    const { service, eventRepo } = makeService();
    await service.update('evt-1', { title: 'Novo' }, 'user-9');
    expect(eventRepo.update).toHaveBeenCalledWith(
      'evt-1',
      expect.objectContaining({ title: 'Novo', lastEditedById: 'user-9' }),
    );
  });

  it('update omits lastEditedById when no editor provided', async () => {
    const { service, eventRepo } = makeService();
    await service.update('evt-1', { title: 'Novo' });
    expect(eventRepo.update).toHaveBeenCalledWith('evt-1', { title: 'Novo' });
  });

  it('updateStatus forwards editor to repo', async () => {
    const { service, eventRepo } = makeService();
    await service.updateStatus('evt-1', 'published', 'user-9');
    expect(eventRepo.updateStatus).toHaveBeenCalledWith('evt-1', 'published', 'user-9');
  });

  it('uploadCover stamps lastEditedById when editor provided', async () => {
    const { service, eventRepo, storage } = makeService();
    storage.upload.mockResolvedValue({ url: 'https://storage/evt-1/cover' });
    await service.uploadCover('evt-1', Buffer.from('x'), 'image/png', 'user-9');
    expect(eventRepo.update).toHaveBeenCalledWith(
      'evt-1',
      expect.objectContaining({ coverUrl: 'https://storage/evt-1/cover', lastEditedById: 'user-9' }),
    );
  });
});
