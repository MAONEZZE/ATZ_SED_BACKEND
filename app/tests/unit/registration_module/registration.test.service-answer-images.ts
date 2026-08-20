import { RegistrationService } from '@application/registration_module/registration.service';

const DATE = new Date('2026-08-19T12:00:00Z');
const BASE64 = 'data:image/png;base64,AAAA';
const STORED = 'https://proj.supabase.co/storage/v1/object/public/ATZ_SED/foto.png';

const event = {
  id: 'evt-1',
  ownerId: 'owner-1',
  slug: 'tech-day',
  title: 'Tech Day',
  status: 'published',
  capacity: null,
};

function make(overrides?: { existing?: unknown }) {
  const regRepo = {
    findByEventAndContact: jest
      .fn()
      .mockResolvedValue(overrides && 'existing' in overrides ? overrides.existing : null),
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'reg-new', ...data })),
    countByEvent: jest.fn().mockResolvedValue(0),
    findById: jest.fn().mockResolvedValue({
      id: 'reg-1',
      eventId: 'evt-1',
      answers: { Nome: 'João' },
      createdAt: DATE,
    }),
    updateAnswers: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
  };
  const eventsService = {
    findBySlug: jest.fn().mockResolvedValue(event),
    findById: jest.fn().mockResolvedValue(event),
  };
  const emitter = { emit: jest.fn() };
  const pipedrive = { send: jest.fn().mockResolvedValue(undefined) };
  const forms = {
    findPublic: jest
      .fn()
      .mockResolvedValue({ id: 'form-1', requireImageAuthorization: false, sendToPipedrive: false }),
    primary: jest.fn(),
    findOne: jest.fn(),
  };
  const formResponses = {
    upsert: jest.fn().mockResolvedValue({ id: 'resp-1', pipedriveStatus: null }),
    setPipedriveStatus: jest.fn().mockResolvedValue(undefined),
  };
  const formFields = {
    listValidationFields: jest
      .fn()
      .mockResolvedValue([{ label: 'Foto', type: 'image', required: false, isFixed: false }]),
  };
  // Simula a materialização de verdade: data URI entra, URL sai.
  const answerImages = {
    materialize: jest.fn().mockImplementation((answers: Record<string, unknown>) =>
      Promise.resolve(
        Object.fromEntries(
          Object.entries(answers).map(([k, v]) => [k, v === BASE64 ? STORED : v]),
        ),
      ),
    ),
  };
  const service = new RegistrationService(
    regRepo as any,
    eventsService as any,
    emitter as any,
    pipedrive as any,
    forms as any,
    formResponses as any,
    formFields as any,
    answerImages as any,
  );
  return { service, regRepo, pipedrive, forms, formResponses, answerImages };
}

// A submissão usa o MESMO objeto answers em três consumidores. Converter depois
// de qualquer um deles deixaria base64 vazando pelos outros — em especial para o
// Pipedrive, que recebe `answers` inteiro.
describe('RegistrationService.submitForm — imagem materializada', () => {
  it('converts once, before anything is written', async () => {
    const { service, answerImages } = make();

    await service.submitForm('tech-day', 'inscricao', '11999998888', { Foto: BASE64 });

    expect(answerImages.materialize).toHaveBeenCalledTimes(1);
    expect(answerImages.materialize).toHaveBeenCalledWith(
      { Foto: BASE64 },
      { eventId: 'evt-1', formId: 'form-1' },
    );
  });

  it('stores the URL on the registration, never the base64', async () => {
    const { service, regRepo } = make();

    await service.submitForm('tech-day', 'inscricao', '11999998888', { Foto: BASE64 });

    expect(regRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ answers: { Foto: STORED } }),
    );
  });

  it('stores the URL on the FormResponse', async () => {
    const { service, formResponses } = make();

    await service.submitForm('tech-day', 'inscricao', '11999998888', { Foto: BASE64 });

    expect(formResponses.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ answers: { Foto: STORED } }),
    );
  });

  it('sends the URL to the CRM, not megabytes of base64', async () => {
    const { service, forms, pipedrive } = make();
    forms.findPublic.mockResolvedValue({
      id: 'form-1',
      requireImageAuthorization: false,
      sendToPipedrive: true,
    });

    await service.submitForm('tech-day', 'inscricao', '11999998888', { Foto: BASE64 });

    expect(pipedrive.send).toHaveBeenCalledWith(
      expect.objectContaining({ answers: { Foto: STORED } }),
    );
  });

  it('still materializes when the registration already exists', async () => {
    const { service, formResponses, answerImages } = make({
      existing: { id: 'reg-1', eventId: 'evt-1', name: 'João', email: 'j@t.com', phone: '5511' },
    });

    await service.submitForm('tech-day', 'inscricao', '11999998888', { Foto: BASE64 });

    expect(answerImages.materialize).toHaveBeenCalledTimes(1);
    expect(formResponses.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ answers: { Foto: STORED } }),
    );
  });
});

// Sem isso o painel reintroduz base64 no JSON que a submissão pública limpou.
describe('RegistrationService.updateAnswers — imagem materializada', () => {
  const fields = [{ label: 'Foto', type: 'image', required: false, isFixed: false }];

  it('converts the edited answers before merging', async () => {
    const { service, regRepo, answerImages } = make();

    await service.updateAnswers('reg-1', 'evt-1', { Foto: BASE64 }, fields);

    expect(answerImages.materialize).toHaveBeenCalledWith({ Foto: BASE64 }, { eventId: 'evt-1' });
    expect(regRepo.updateAnswers).toHaveBeenCalledWith(
      'reg-1',
      expect.objectContaining({ answers: { Nome: 'João', Foto: STORED } }),
    );
  });

  it('keeps the untouched answers that were already stored', async () => {
    const { service, regRepo } = make();

    await service.updateAnswers('reg-1', 'evt-1', { Nome: 'Maria' }, fields);

    expect(regRepo.updateAnswers).toHaveBeenCalledWith(
      'reg-1',
      expect.objectContaining({ answers: { Nome: 'Maria' } }),
    );
  });
});
