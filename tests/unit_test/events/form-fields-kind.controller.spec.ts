import { FormFieldsService } from '@modules/events/form-fields.service';

function makeService() {
  const repo = {
    create: jest.fn().mockResolvedValue({ id: 'f1' }),
    update: jest.fn().mockResolvedValue({ id: 'f1' }),
    delete: jest.fn().mockResolvedValue(undefined),
    findByEvent: jest.fn().mockResolvedValue({ id: 'f1' }),
    findAllByEventPaginated: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    touchEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
  };
  const eventsService = {
    findById: jest.fn().mockResolvedValue({ isEditable: () => true }),
  };
  const formsService = {
    getOrCreate: jest.fn().mockResolvedValue({ id: 'form-1' }),
  };
  return {
    service: new FormFieldsService(repo as any, eventsService as any, formsService as any),
    repo,
    eventsService,
    formsService,
  };
}

describe('FormFieldsService kind support', () => {
  beforeEach(() => jest.clearAllMocks());

  it('default kind registration on create when omitted', async () => {
    const { service, repo, formsService } = makeService();
    await service.create('evt-1', 'user-1', { label: 'Nome', type: 'text' });
    expect(formsService.getOrCreate).toHaveBeenCalledWith('evt-1', 'registration');
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ formId: 'form-1' }));
  });

  it('resolves the Form for the given kind on create', async () => {
    const { service, formsService } = makeService();
    await service.create('evt-1', 'user-1', { label: 'Nota', type: 'text', kind: 'post_event' });
    expect(formsService.getOrCreate).toHaveBeenCalledWith('evt-1', 'post_event');
  });

  it('stamps last editor on the event after creating a field', async () => {
    const { service, repo } = makeService();
    await service.create('evt-1', 'user-1', { label: 'Nome', type: 'text' });
    expect(repo.touchEvent).toHaveBeenCalledWith('evt-1', 'user-1');
  });

  it('filters listPaginated by kind when given', async () => {
    const { service, repo } = makeService();
    await service.listPaginated('evt-1', 'post_event', 1, 20);
    expect(repo.findAllByEventPaginated).toHaveBeenCalledWith(
      'evt-1',
      'post_event',
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it('listPaginated without kind passes undefined kind', async () => {
    const { service, repo } = makeService();
    await service.listPaginated('evt-1', undefined, 1, 20);
    expect(repo.findAllByEventPaginated).toHaveBeenCalledWith(
      'evt-1',
      undefined,
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });
});
