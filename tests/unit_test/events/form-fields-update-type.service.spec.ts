import { FormFieldsService } from '@modules/events/form-fields.service';

function makeService(existingField: Record<string, unknown> = { id: 'f1', label: 'Campo', type: 'text', options: null }) {
  const repo = {
    create: jest.fn().mockResolvedValue({ id: 'f1' }),
    update: jest.fn().mockResolvedValue({ id: 'f1' }),
    delete: jest.fn().mockResolvedValue(undefined),
    findByEvent: jest.fn().mockResolvedValue(existingField),
    findAllByEventPaginated: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    touchEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
  };
  const eventsService = {
    findById: jest.fn().mockResolvedValue({ isEditable: () => true }),
  };
  return { service: new FormFieldsService(repo as any, eventsService as any), repo, eventsService };
}

describe('FormFieldsService.update — type change', () => {
  beforeEach(() => jest.clearAllMocks());

  it('persists the new type on PATCH', async () => {
    const { service, repo } = makeService();
    await service.update('evt-1', 'f1', 'user-1', { type: 'select', options: ['A', 'B'] });
    expect(repo.update).toHaveBeenCalledWith(
      'f1',
      expect.objectContaining({ type: 'select', options: ['A', 'B'] }),
    );
  });

  it('does not require type in the payload (backward compatible)', async () => {
    const { service, repo } = makeService();
    await service.update('evt-1', 'f1', 'user-1', { label: 'Novo label' });
    expect(repo.update).toHaveBeenCalledWith('f1', expect.objectContaining({ label: 'Novo label' }));
    expect(repo.update).toHaveBeenCalledWith('f1', expect.not.objectContaining({ type: expect.anything() }));
  });

  it('logs a warning but does not throw when changing to select/multiselect without usable options', async () => {
    const { service } = makeService({ id: 'f1', label: 'Campo', type: 'text', options: null });
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);

    await expect(
      service.update('evt-1', 'f1', 'user-1', { type: 'select' }),
    ).resolves.not.toThrow();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('without a usable options array'));
  });

  it('logs a generic warning when changing type without touching options coherence', async () => {
    const { service } = makeService({ id: 'f1', label: 'Campo', type: 'text', options: null });
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);

    await service.update('evt-1', 'f1', 'user-1', { type: 'date' });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('changed type from "text" to "date"'));
  });

  it('does not warn when type is unchanged', async () => {
    const { service } = makeService({ id: 'f1', label: 'Campo', type: 'text', options: null });
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);

    await service.update('evt-1', 'f1', 'user-1', { type: 'text', label: 'X' });

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
