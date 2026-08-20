import { EventController } from '@api/controllers/event_module/event.controller';
import { EventEntity } from '@domain/event_module/event.entity';
import { AuthenticatedUser } from '@domain/shared/authenticated-user.entity';

function make() {
  const eventsService = { findById: jest.fn(), findAllPaginated: jest.fn() };
  const ctrl = new EventController(eventsService as any, {} as any);
  return { ctrl, eventsService };
}

const entity = () => new EventEntity('evt-1', 'owner-1', 'Festa', 'festa-abc', 'draft');

describe('EventController myRole', () => {
  beforeEach(() => jest.clearAllMocks());

  it('merges the role resolved by the guard into the event detail', async () => {
    const { ctrl, eventsService } = make();
    eventsService.findById.mockResolvedValue(entity());

    const result = (await ctrl.findOne('evt-1', 'read')) as EventEntity & { myRole: string };

    expect(result.myRole).toBe('read');
    expect(result.id).toBe('evt-1');
    expect(eventsService.findById).toHaveBeenCalledWith('evt-1');
  });

  it('passes admin through untouched for the owner', async () => {
    const { ctrl, eventsService } = make();
    eventsService.findById.mockResolvedValue(entity());

    const result = (await ctrl.findOne('evt-1', 'admin')) as EventEntity & { myRole: string };

    expect(result.myRole).toBe('admin');
  });

  // A lista não passa pelo OwnershipGuard (não tem eventId na rota): o myRole de
  // cada card vem do repositório, o controller só repassa.
  it('keeps myRole of each item on the paginated list', async () => {
    const { ctrl, eventsService } = make();
    eventsService.findAllPaginated.mockResolvedValue({
      data: [Object.assign(entity(), { myRole: 'invited' })],
      total: 1,
    });

    const result = await ctrl.findAll({ id: 'user-1' } as AuthenticatedUser, {});

    expect(result.data[0]).toMatchObject({ myRole: 'invited' });
    expect(eventsService.findAllPaginated).toHaveBeenCalledWith('user-1', 1, 20, undefined);
  });
});
