import { CollaboratorsController } from '../../app/api/controllers/events/events_routes/collaborators.controller';

function make() {
  const service = {
    list: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
  };
  const ctrl = new CollaboratorsController(service as any);
  return { ctrl, service };
}

describe('CollaboratorsController', () => {
  beforeEach(() => jest.clearAllMocks());

  it('list delegates to service.list with the event id', async () => {
    const { ctrl, service } = make();
    const rows = [{ id: 'c1', profileId: 'p2' }];
    service.list.mockResolvedValue(rows);
    await expect(ctrl.list('evt-1')).resolves.toBe(rows);
    expect(service.list).toHaveBeenCalledWith('evt-1');
  });

  it('add delegates eventId and dto.email to service.add', async () => {
    const { ctrl, service } = make();
    const created = { id: 'c1', eventId: 'evt-1', profileId: 'p2' };
    service.add.mockResolvedValue(created);
    await expect(ctrl.add('evt-1', { email: 'bob@x.com' })).resolves.toBe(created);
    expect(service.add).toHaveBeenCalledWith('evt-1', 'bob@x.com');
  });

  it('remove delegates eventId and profileId to service.remove', async () => {
    const { ctrl, service } = make();
    service.remove.mockResolvedValue(undefined);
    await ctrl.remove('evt-1', 'p2');
    expect(service.remove).toHaveBeenCalledWith('evt-1', 'p2');
  });

  it('propagates service errors (e.g. add of unknown email)', async () => {
    const { ctrl, service } = make();
    service.add.mockRejectedValue(new Error('No registered user with this email.'));
    await expect(ctrl.add('evt-1', { email: 'ghost@x.com' })).rejects.toThrow(
      'No registered user',
    );
  });
});
