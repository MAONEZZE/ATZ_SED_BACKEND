import { NotFoundException } from '@nestjs/common';
import { EventService } from '@application/event_module/event.service';

function makeService(moved: boolean) {
  const eventRepo = { move: jest.fn().mockResolvedValue(moved) };
  const service = new EventService(
    eventRepo as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { service, eventRepo };
}

describe('EventService.move', () => {
  it('delegates the anchor to the repository', async () => {
    const { service, eventRepo } = makeService(true);

    await service.move('user-1', 'evt-1', 'evt-2');

    expect(eventRepo.move).toHaveBeenCalledWith('user-1', 'evt-1', 'evt-2');
  });

  // Evento inacessível e âncora de outro escopo dão o mesmo 404: o backend não
  // revela a existência de evento que o usuário não alcança.
  it('404s when the repository refuses the move', async () => {
    const { service } = makeService(false);

    await expect(service.move('user-1', 'evt-1', 'evt-2')).rejects.toThrow(NotFoundException);
  });
});
