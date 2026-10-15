import { ConflictException } from '@nestjs/common';
import { EventService } from '@application/event_module/event.service';
import { EventEntity } from '@domain/event_module/event.entity';

const existing = new EventEntity('evt-1', 'owner-1', 'Tech Day', 'tech-day-abc', 'draft');
const other = new EventEntity('evt-2', 'owner-2', 'Outro', 'outro-evento', 'draft');

function makeService(bySlug: EventEntity | null = null) {
  const eventRepo = {
    findById: jest.fn().mockResolvedValue(existing),
    findBySlug: jest.fn().mockResolvedValue(bySlug),
    create: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    update: jest.fn().mockImplementation((_id, data) => Promise.resolve(data)),
  };
  const service = new EventService(
    eventRepo as any,
    {} as any,
    {} as any,
    { isAllowedForProfile: jest.fn().mockResolvedValue(true) } as any,
    {} as any,
    { get: jest.fn() } as any,
  );
  return { service, eventRepo };
}

describe('EventService slug', () => {
  it('create passes a free custom slug to the repository', async () => {
    const { service, eventRepo } = makeService(null);
    await service.create('owner-1', { title: 'Evento', slug: 'meu-evento' });
    expect(eventRepo.findBySlug).toHaveBeenCalledWith('meu-evento');
    expect(eventRepo.create).toHaveBeenCalledWith(expect.objectContaining({ slug: 'meu-evento' }));
  });

  it('create rejects a slug already used by another event', async () => {
    const { service, eventRepo } = makeService(other);
    await expect(
      service.create('owner-1', { title: 'Evento', slug: 'outro-evento' }),
    ).rejects.toThrow(ConflictException);
    expect(eventRepo.create).not.toHaveBeenCalled();
  });

  it('create without slug skips the lookup', async () => {
    const { service, eventRepo } = makeService(null);
    await service.create('owner-1', { title: 'Evento' });
    expect(eventRepo.findBySlug).not.toHaveBeenCalled();
  });

  it('update rejects a slug already used by another event', async () => {
    const { service, eventRepo } = makeService(other);
    await expect(service.update('evt-1', { slug: 'outro-evento' })).rejects.toThrow(
      ConflictException,
    );
    expect(eventRepo.update).not.toHaveBeenCalled();
  });

  it('update accepts the event own current slug', async () => {
    const { service, eventRepo } = makeService(existing);
    await service.update('evt-1', { slug: 'tech-day-abc' });
    expect(eventRepo.update).toHaveBeenCalledWith(
      'evt-1',
      expect.objectContaining({ slug: 'tech-day-abc' }),
    );
  });

  it('update applies a free new slug', async () => {
    const { service, eventRepo } = makeService(null);
    await service.update('evt-1', { slug: 'novo-slug' });
    expect(eventRepo.update).toHaveBeenCalledWith(
      'evt-1',
      expect.objectContaining({ slug: 'novo-slug' }),
    );
  });

  it('update without slug does not touch it', async () => {
    const { service, eventRepo } = makeService(null);
    await service.update('evt-1', { title: 'Novo título' });
    expect(eventRepo.findBySlug).not.toHaveBeenCalled();
    expect(eventRepo.update).toHaveBeenCalledWith('evt-1', { title: 'Novo título' });
  });
});
