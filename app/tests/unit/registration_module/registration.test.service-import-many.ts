import { Prisma } from '@prisma/client';
import { RegistrationService } from '@application/registration_module/registration.service';

function make(existingByContact: Record<string, unknown> | null = null) {
  const regRepo = {
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'reg-new', ...data })),
    findByEventAndContact: jest.fn().mockResolvedValue(existingByContact),
  };
  const eventsService = { findBySlug: jest.fn(), findById: jest.fn() };
  const emitter = { emit: jest.fn() };
  const pipedrive = { send: jest.fn() };
  const formsService = {
    findOne: jest.fn().mockResolvedValue({ id: 'form-1' }),
    primary: jest.fn(),
    findPublic: jest.fn(),
  };
  const svc = new RegistrationService(
    regRepo as any,
    eventsService as any,
    emitter as any,
    pipedrive as any,
    formsService as any,
    { upsert: jest.fn() } as any,
    { listValidationFields: jest.fn().mockResolvedValue([]) } as any,
    { materialize: jest.fn().mockImplementation((a) => Promise.resolve(a)) } as any,
  );
  return { svc, regRepo, emitter, pipedrive, formsService };
}

describe('RegistrationService.importMany', () => {
  beforeEach(() => jest.clearAllMocks());

  it('validates the form belongs to the event before importing', async () => {
    const { svc, formsService } = make(null);
    await svc.importMany('evt-1', 'form-1', [{ nome: 'Fulano', email: 'fulano@x.com' }]);

    expect(formsService.findOne).toHaveBeenCalledWith('form-1', 'evt-1');
  });

  it('creates registrations for new contacts, normalizing phone to a common digit form', async () => {
    const { svc, regRepo } = make(null);
    const items = [
      { nome: 'Fulano', telefone: '(11) 91234-5678' },
      { nome: 'Ciclano', telefone: '11912345679' },
    ];

    const result = await svc.importMany('evt-1', 'form-1', items);

    expect(result).toEqual({ created: 2, skipped: 0, rejected: [] });
    expect(regRepo.create).toHaveBeenNthCalledWith(1, {
      eventId: 'evt-1',
      answers: { nome: 'Fulano', telefone: '5511912345678' },
      name: 'Fulano',
      email: '',
      phone: '5511912345678',
      imageAuthorization: false,
      originFormId: 'form-1',
    });
  });

  it('rejects items lacking both phone and email, reporting the line and reason', async () => {
    const { svc, regRepo } = make(null);
    const result = await svc.importMany('evt-1', 'form-1', [{ nome: 'Sem contato' }]);

    expect(result).toEqual({
      created: 0,
      skipped: 1,
      rejected: [{ linha: 1, motivo: 'sem telefone nem email' }],
    });
    expect(regRepo.create).not.toHaveBeenCalled();
  });

  it('rejects items that already match an existing registration (dedup)', async () => {
    const { svc, regRepo } = make({ id: 'reg-existing' });
    const result = await svc.importMany('evt-1', 'form-1', [
      { nome: 'Fulano', telefone: '11912345678' },
    ]);

    expect(result).toEqual({
      created: 0,
      skipped: 1,
      rejected: [{ linha: 1, motivo: 'já inscrito neste evento' }],
    });
    expect(regRepo.create).not.toHaveBeenCalled();
  });

  // Import em lote é carga de planilha: não dispara automação nem CRM.
  it('does not emit registration.status_changed nor call pipedrive', async () => {
    const { svc, emitter, pipedrive } = make(null);
    await svc.importMany('evt-1', 'form-1', [{ nome: 'Fulano', email: 'fulano@x.com' }]);

    expect(emitter.emit).not.toHaveBeenCalled();
    expect(pipedrive.send).not.toHaveBeenCalled();
  });

  it('lowercases and trims email before dedup lookup and storage', async () => {
    const { svc, regRepo } = make(null);
    await svc.importMany('evt-1', 'form-1', [{ nome: 'Fulano', email: '  Fulano@X.com  ' }]);

    expect(regRepo.findByEventAndContact).toHaveBeenCalledWith('evt-1', {
      email: 'fulano@x.com',
      phone: undefined,
    });
    expect(regRepo.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'fulano@x.com' }));
  });

  // Duas linhas só-email colidem no índice único (event_id, '') — o pré-check
  // por email não pega essa classe, então a trava real é o P2002 do banco.
  it('counts a P2002 unique-violation as rejected instead of throwing (two email-only rows)', async () => {
    const { svc, regRepo } = make(null);
    const p2002 = Object.assign(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
      { code: 'P2002' },
    );
    regRepo.create.mockResolvedValueOnce({ id: 'reg-new' }).mockRejectedValueOnce(p2002);

    const result = await svc.importMany('evt-1', 'form-1', [
      { nome: 'Fulano', email: 'fulano@x.com' },
      { nome: 'Ciclano', email: 'ciclano@x.com' },
    ]);

    expect(result).toEqual({
      created: 1,
      skipped: 1,
      rejected: [{ linha: 2, motivo: 'telefone já usado neste evento' }],
    });
  });
});
