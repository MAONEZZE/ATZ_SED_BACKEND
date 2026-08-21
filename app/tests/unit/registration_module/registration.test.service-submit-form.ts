import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RegistrationService } from '@application/registration_module/registration.service';

const DATE = new Date('2026-08-17T12:00:00Z');

const event = {
  id: 'evt-1',
  ownerId: 'owner-1',
  slug: 'tech-day',
  title: 'Tech Day',
  status: 'published',
  capacity: null as number | null,
  eventDate: new Date('2026-09-10T18:30:00Z'),
};

const form = { id: 'form-1', requireImageAuthorization: false, sendToPipedrive: false };

const NOTA_FIELD_ID = 'nota-field-id';
const NOME_FIELD_ID = 'nome-field-id';
const OPCAO_FIELD_ID = 'opcao-field-id';

const existingReg = {
  id: 'reg-1',
  eventId: 'evt-1',
  name: 'João',
  email: 'joao@test.com',
  phone: '5511999998888',
  status: 'approved',
  answers: {},
  createdAt: DATE,
  updatedAt: DATE,
};

function make(overrides?: {
  existing?: unknown;
  eventStatus?: string;
  capacity?: number | null;
  count?: number;
  requireImage?: boolean;
  sendToPipedrive?: boolean;
  responsePipedriveStatus?: string | null;
  anonymous?: boolean;
}) {
  const regRepo = {
    findByEventAndContact: jest
      .fn()
      .mockResolvedValue(overrides && 'existing' in overrides ? overrides.existing : existingReg),
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'reg-new', ...data })),
    countByEvent: jest.fn().mockResolvedValue(overrides?.count ?? 0),
  };
  const eventsService = {
    findBySlug: jest.fn().mockResolvedValue({
      ...event,
      status: overrides?.eventStatus ?? 'published',
      capacity: overrides?.capacity ?? null,
    }),
    findById: jest.fn(),
  };
  const emitter = { emit: jest.fn() };
  const pipedrive = { send: jest.fn().mockResolvedValue(undefined) };
  const forms = {
    findPublic: jest.fn().mockResolvedValue({
      ...form,
      requireImageAuthorization: overrides?.requireImage ?? false,
      sendToPipedrive: overrides?.sendToPipedrive ?? false,
      anonymous: overrides?.anonymous ?? false,
    }),
    primary: jest.fn(),
    findOne: jest.fn(),
  };
  const formResponses = {
    upsert: jest
      .fn()
      .mockResolvedValue({
        id: 'resp-1',
        pipedriveStatus: overrides?.responsePipedriveStatus ?? null,
      }),
    setPipedriveStatus: jest.fn().mockResolvedValue(undefined),
  };
  const formFields = {
    listValidationFields: jest.fn().mockResolvedValue([
      { id: NOTA_FIELD_ID, label: 'Nota', type: 'text', required: false, isFixed: false },
      { id: NOME_FIELD_ID, label: 'nome', type: 'text', required: false, isFixed: false },
      { id: OPCAO_FIELD_ID, label: 'opcao', type: 'text', required: false, isFixed: false },
    ]),
  };
  // Pass-through por padrão; os testes de imagem trocam o retorno para provar
  // que é o valor convertido que chega em inscrito, FormResponse e Pipedrive.
  const answerImages = { materialize: jest.fn().mockImplementation((a) => Promise.resolve(a)) };
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
  return { service, regRepo, emitter, pipedrive, forms, formResponses, answerImages };
}

// O telefone é a identidade: casa com o inscrito do evento; sem match, cria.
describe('RegistrationService.submitForm — identidade por telefone', () => {
  it('attaches the response to the matching registration without creating another', async () => {
    const { service, regRepo, formResponses } = make();

    const result = await service.submitForm('tech-day', 'nps', '(11) 99999-8888', { Nota: '9' });

    expect(regRepo.findByEventAndContact).toHaveBeenCalledWith('evt-1', {
      phone: '5511999998888',
    });
    expect(regRepo.create).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
    expect(formResponses.upsert).toHaveBeenCalledWith({
      formId: 'form-1',
      eventId: 'evt-1',
      registrationId: 'reg-1',
      answers: { [NOTA_FIELD_ID]: '9' },
    });
  });

  it('creates the registration when no phone matches', async () => {
    const { service, regRepo, emitter } = make({ existing: null });

    const result = await service.submitForm('tech-day', 'inscricao', '11912345678', {
      nome: 'Maria',
    });

    expect(regRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt-1', phone: '5511912345678', name: 'Maria' }),
    );
    expect(result.created).toBe(true);
    // Inscrito novo entra no funil, então o gatilho on_registration precisa sair.
    expect(emitter.emit).toHaveBeenCalledWith(
      'registration.status_changed',
      expect.objectContaining({ newStatus: 'pending' }),
    );
  });

  it('rejects an empty phone', async () => {
    const { service, formResponses } = make();

    await expect(service.submitForm('tech-day', 'nps', '   ', {})).rejects.toThrow(
      BadRequestException,
    );
    expect(formResponses.upsert).not.toHaveBeenCalled();
  });

  it('reuses the same response row on resubmit (upsert por form + inscrito)', async () => {
    const { service, formResponses } = make();

    await service.submitForm('tech-day', 'nps', '11999998888', { Nota: '7' });
    await service.submitForm('tech-day', 'nps', '11999998888', { Nota: '10' });

    expect(formResponses.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ answers: { [NOTA_FIELD_ID]: '10' } }),
    );
  });
});

describe('RegistrationService.submitForm — regras do evento', () => {
  it('emits form.submitted with the formId so the automation can filter by form', async () => {
    const { service, emitter } = make();

    await service.submitForm('tech-day', 'nps', '11999998888', {});

    expect(emitter.emit).toHaveBeenCalledWith(
      'form.submitted',
      expect.objectContaining({ eventId: 'evt-1', formId: 'form-1' }),
    );
  });

  it('accepts a response on an event that already ended', async () => {
    const { service, formResponses } = make({ eventStatus: 'ended' });

    await service.submitForm('tech-day', 'nps', '11999998888', {});

    expect(formResponses.upsert).toHaveBeenCalled();
  });

  it('refuses a response on a draft event', async () => {
    const { service } = make({ eventStatus: 'draft' });

    await expect(service.submitForm('tech-day', 'nps', '11999998888', {})).rejects.toThrow(
      BadRequestException,
    );
  });

  // Inscrito novo num evento encerrado não faz sentido: a inscrição está fechada.
  it('refuses to create a registration on an ended event', async () => {
    const { service, regRepo } = make({ existing: null, eventStatus: 'ended' });

    await expect(service.submitForm('tech-day', 'nps', '11999998888', {})).rejects.toThrow(
      BadRequestException,
    );
    expect(regRepo.create).not.toHaveBeenCalled();
  });

  it('refuses a new registration past capacity', async () => {
    const { service, regRepo } = make({ existing: null, capacity: 2, count: 2 });

    await expect(
      service.submitForm('tech-day', 'inscricao', '11912345678', { nome: 'Maria' }),
    ).rejects.toThrow(BadRequestException);
    expect(regRepo.create).not.toHaveBeenCalled();
  });

  // Capacidade limita inscrito novo, não resposta de quem já está dentro.
  it('lets an existing registration answer even past capacity', async () => {
    const { service, formResponses } = make({ capacity: 1, count: 5 });

    await service.submitForm('tech-day', 'nps', '11999998888', {});

    expect(formResponses.upsert).toHaveBeenCalled();
  });

  it('requires image authorization when the form demands it', async () => {
    const { service } = make({ existing: null, requireImage: true });

    await expect(
      service.submitForm('tech-day', 'inscricao', '11912345678', { nome: 'Maria' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts the new registration when authorization is given', async () => {
    const { service, regRepo } = make({ existing: null, requireImage: true });

    await service.submitForm(
      'tech-day',
      'inscricao',
      '11912345678',
      { nome: 'Maria' },
      { imageAuthorization: true },
    );

    expect(regRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ imageAuthorization: true }),
    );
  });

  it('404s an unknown form slug', async () => {
    const { service, forms } = make();
    forms.findPublic.mockRejectedValue(new NotFoundException('Form not found'));

    await expect(service.submitForm('tech-day', 'nao-existe', '11999998888', {})).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('RegistrationService.submitForm — Pipedrive', () => {
  it('marks skipped when the form does not ask for it', async () => {
    const { service, formResponses, pipedrive } = make({ existing: null });

    await service.submitForm('tech-day', 'inscricao', '11912345678', { nome: 'Maria' });

    expect(formResponses.setPipedriveStatus).toHaveBeenCalledWith('resp-1', 'skipped');
    expect(pipedrive.send).not.toHaveBeenCalled();
  });

  it('marks pending and sends when the form asks for it', async () => {
    const { service, formResponses, pipedrive } = make({ existing: null, sendToPipedrive: true });

    await service.submitForm('tech-day', 'inscricao', '11912345678', { nome: 'Maria' });

    expect(formResponses.setPipedriveStatus).toHaveBeenCalledWith('resp-1', 'pending');
    expect(pipedrive.send).toHaveBeenCalled();
  });

  // A data do evento vai no payload em ISO — o n8n a usa no negócio do Pipedrive.
  it('sends the event date in the payload', async () => {
    const { service, pipedrive } = make({ existing: null, sendToPipedrive: true });

    await service.submitForm('tech-day', 'inscricao', '11912345678', { nome: 'Maria' });

    expect(pipedrive.send).toHaveBeenCalledWith(
      expect.objectContaining({
        event: {
          id: 'evt-1',
          slug: 'tech-day',
          title: 'Tech Day',
          eventDate: '2026-09-10T18:30:00.000Z',
        },
      }),
    );
  });

  // Caso que o antigo gate `!existing` bloqueava: quem já era inscrito também
  // dispara ao responder um formulário com a flag ligada.
  it('sends for an existing registration when the form asks for it', async () => {
    const { service, formResponses, pipedrive } = make({ sendToPipedrive: true });

    await service.submitForm('tech-day', 'nps', '11999998888', {});

    expect(formResponses.setPipedriveStatus).toHaveBeenCalledWith('resp-1', 'pending');
    expect(pipedrive.send).toHaveBeenCalled();
  });

  it('does not resend a response already marked sent', async () => {
    const { service, formResponses, pipedrive } = make({
      sendToPipedrive: true,
      responsePipedriveStatus: 'sent',
    });

    await service.submitForm('tech-day', 'nps', '11999998888', {});

    expect(formResponses.setPipedriveStatus).not.toHaveBeenCalled();
    expect(pipedrive.send).not.toHaveBeenCalled();
  });

  it('retries a response marked failed', async () => {
    const { service, formResponses, pipedrive } = make({
      sendToPipedrive: true,
      responsePipedriveStatus: 'failed',
    });

    await service.submitForm('tech-day', 'nps', '11999998888', {});

    expect(formResponses.setPipedriveStatus).toHaveBeenCalledWith('resp-1', 'pending');
    expect(pipedrive.send).toHaveBeenCalled();
  });
});

// Formulário anônimo: sem telefone, sem inscrito. Bifurca antes de tudo que
// depende de telefone (createFromForm, capacidade, form.submitted, Pipedrive).
describe('RegistrationService.submitForm — formulário anônimo', () => {
  it('records the response with a null registrationId and creates no Registration', async () => {
    const { service, regRepo, formResponses } = make({ anonymous: true });

    const result = await service.submitForm('tech-day', 'voto', undefined, { opcao: 'A' });

    expect(regRepo.create).not.toHaveBeenCalled();
    expect(regRepo.findByEventAndContact).not.toHaveBeenCalled();
    expect(result).toEqual({ registration: null, created: false });
    expect(formResponses.upsert).toHaveBeenCalledWith({
      formId: 'form-1',
      eventId: 'evt-1',
      registrationId: null,
      answers: { [OPCAO_FIELD_ID]: 'A' },
    });
  });

  it('does not emit form.submitted', async () => {
    const { service, emitter } = make({ anonymous: true });

    await service.submitForm('tech-day', 'voto', undefined, { opcao: 'A' });

    expect(emitter.emit).not.toHaveBeenCalledWith('form.submitted', expect.anything());
  });

  it('does not dispatch to Pipedrive', async () => {
    const { service, formResponses, pipedrive } = make({ anonymous: true, sendToPipedrive: true });

    await service.submitForm('tech-day', 'voto', undefined, { opcao: 'A' });

    expect(formResponses.setPipedriveStatus).not.toHaveBeenCalled();
    expect(pipedrive.send).not.toHaveBeenCalled();
  });

  it('does not consume event capacity', async () => {
    const { service, regRepo } = make({ anonymous: true, capacity: 1, count: 1 });

    await expect(
      service.submitForm('tech-day', 'voto', undefined, { opcao: 'A' }),
    ).resolves.toBeDefined();
    expect(regRepo.countByEvent).not.toHaveBeenCalled();
  });

  it('creates a new row for each anonymous submission (non-idempotent)', async () => {
    const { service, formResponses } = make({ anonymous: true });

    await service.submitForm('tech-day', 'voto', undefined, { opcao: 'A' });
    await service.submitForm('tech-day', 'voto', undefined, { opcao: 'B' });

    expect(formResponses.upsert).toHaveBeenCalledTimes(2);
    expect(formResponses.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ registrationId: null, answers: { [OPCAO_FIELD_ID]: 'A' } }),
    );
    expect(formResponses.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ registrationId: null, answers: { [OPCAO_FIELD_ID]: 'B' } }),
    );
  });

  it('still requires a phone on a non-anonymous form', async () => {
    const { service, formResponses } = make({ anonymous: false });

    await expect(service.submitForm('tech-day', 'nps', undefined, { Nota: '9' })).rejects.toThrow(
      BadRequestException,
    );
    expect(formResponses.upsert).not.toHaveBeenCalled();
  });
});
