import { RegistrationsService } from '@modules/registrations/registrations.service';

function make(existingByContact: Record<string, unknown> | null = null) {
  const regRepo = {
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'reg-new', ...data })),
    findByEventAndContact: jest.fn().mockResolvedValue(existingByContact),
  };
  const eventsService = { findBySlug: jest.fn(), findById: jest.fn() };
  const emitter = { emit: jest.fn() };
  const userSubscriptions = { upsertFromForm: jest.fn(), markPipedrive: jest.fn() };
  const pipedrive = { send: jest.fn() };
  const svc = new RegistrationsService(
    regRepo as any,
    eventsService as any,
    emitter as any,
    userSubscriptions as any,
    pipedrive as any,
  );
  return { svc, regRepo, emitter, userSubscriptions, pipedrive };
}

describe('RegistrationsService.importMany', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates registrations for new contacts, normalizing phone to a common digit form', async () => {
    const { svc, regRepo } = make(null);
    const items = [
      { nome: 'Fulano', telefone: '(11) 91234-5678' },
      { nome: 'Ciclano', telefone: '11912345679' },
    ];

    const result = await svc.importMany('evt-1', items);

    expect(result).toEqual({ created: 2, skipped: 0 });
    expect(regRepo.create).toHaveBeenNthCalledWith(1, {
      eventId: 'evt-1',
      answers: { nome: 'Fulano', telefone: '5511912345678' },
      name: 'Fulano',
      email: '',
      phone: '5511912345678',
    });
  });

  it('skips items lacking both phone and email', async () => {
    const { svc, regRepo } = make(null);
    const result = await svc.importMany('evt-1', [{ nome: 'Sem contato' }]);

    expect(result).toEqual({ created: 0, skipped: 1 });
    expect(regRepo.create).not.toHaveBeenCalled();
  });

  it('skips items that already match an existing registration (dedup)', async () => {
    const { svc, regRepo } = make({ id: 'reg-existing' });
    const result = await svc.importMany('evt-1', [{ nome: 'Fulano', telefone: '11912345678' }]);

    expect(result).toEqual({ created: 0, skipped: 1 });
    expect(regRepo.create).not.toHaveBeenCalled();
  });

  it('does not emit registration.status_changed nor call pipedrive/user-subscriptions', async () => {
    const { svc, emitter, userSubscriptions, pipedrive } = make(null);
    await svc.importMany('evt-1', [{ nome: 'Fulano', email: 'fulano@x.com' }]);

    expect(emitter.emit).not.toHaveBeenCalled();
    expect(userSubscriptions.upsertFromForm).not.toHaveBeenCalled();
    expect(pipedrive.send).not.toHaveBeenCalled();
  });

  it('lowercases and trims email before dedup lookup and storage', async () => {
    const { svc, regRepo } = make(null);
    await svc.importMany('evt-1', [{ nome: 'Fulano', email: '  Fulano@X.com  ' }]);

    expect(regRepo.findByEventAndContact).toHaveBeenCalledWith('evt-1', {
      email: 'fulano@x.com',
      phone: undefined,
    });
    expect(regRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'fulano@x.com' }),
    );
  });
});
