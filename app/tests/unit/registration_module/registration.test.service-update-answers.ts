import { RegistrationService } from '@application/registration_module/registration.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

type FormFieldLike = { id: string; label: string; type: string; required: boolean; isFixed: boolean };

const NOME_ID = 'nome-id';
const EMAIL_ID = 'email-id';
const TEL_ID = 'tel-id';
const CIDADE_ID = 'cidade-id';

function makeService(regOverrides: Partial<{ id: string; eventId: string }> = {}) {
  const reg = {
    id: 'reg-1',
    eventId: 'evt-1',
    status: 'pending',
    answers: {},
    name: 'Old Name',
    email: 'old@test.com',
    phone: '11000',
    createdAt: new Date(),
    updatedAt: new Date(),
    canTransitionTo: jest.fn(),
    ...regOverrides,
  };
  const regRepo = {
    findById: jest.fn().mockResolvedValue(reg),
    updateAnswers: jest.fn().mockImplementation((_id, data) => Promise.resolve({ ...reg, ...data })),
    updateStatus: jest.fn(),
    create: jest.fn(),
    findAllByEvent: jest.fn(),
    findAllByEventPaginated: jest.fn(),
  };
  const eventsService = { findBySlug: jest.fn(), findById: jest.fn() };
  // Pass-through: a conversão de imagem tem testes próprios; aqui só interessa
  // que o resultado dela é o que segue para o repositório.
  const answerImages = { materialize: jest.fn().mockImplementation((a) => Promise.resolve(a)) };
  const formResponses = { upsert: jest.fn(), mergeAnswers: jest.fn().mockResolvedValue(undefined) };
  const service = new RegistrationService(
    regRepo as any,
    eventsService as any,
    { emit: jest.fn() } as any,
    { send: jest.fn() } as any,
    { findOne: jest.fn(), primary: jest.fn(), findPublic: jest.fn() } as any,
    formResponses as any,
    { listValidationFields: jest.fn().mockResolvedValue([]), listLabels: jest.fn().mockResolvedValue([]) } as any,
    answerImages as any,
  );
  return { service, regRepo, answerImages, formResponses };
}

const allFields: FormFieldLike[] = [
  { id: NOME_ID, label: 'Nome', type: 'text', required: true, isFixed: true },
  { id: EMAIL_ID, label: 'E-mail', type: 'email', required: true, isFixed: true },
  { id: TEL_ID, label: 'Telefone', type: 'phone', required: true, isFixed: true },
  { id: CIDADE_ID, label: 'Cidade', type: 'text', required: false, isFixed: false },
];

describe('RegistrationService.updateAnswers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws NotFoundException when registration not found', async () => {
    const { service, regRepo } = makeService();
    regRepo.findById.mockResolvedValue(null);
    await expect(
      service.updateAnswers(
        'reg-1',
        'evt-1',
        { Nome: 'X', 'E-mail': 'x@x.com', Telefone: '1' },
        allFields,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when registration belongs to different event', async () => {
    const { service } = makeService({ eventId: 'OTHER' });
    await expect(
      service.updateAnswers(
        'reg-1',
        'evt-1',
        { Nome: 'X', 'E-mail': 'x@x.com', Telefone: '1' },
        allFields,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when required field is missing from answers', async () => {
    const { service } = makeService();
    // 'Telefone' is required but omitted
    await expect(
      service.updateAnswers('reg-1', 'evt-1', { Nome: 'X', 'E-mail': 'x@x.com' }, allFields),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when required field value is empty string', async () => {
    const { service } = makeService();
    await expect(
      service.updateAnswers(
        'reg-1',
        'evt-1',
        { Nome: '', 'E-mail': 'x@x.com', Telefone: '1' },
        allFields,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('discards extra unknown keys in answers without error (no field matches them)', async () => {
    const { service, regRepo } = makeService();
    await expect(
      service.updateAnswers(
        'reg-1',
        'evt-1',
        { Nome: 'X', 'E-mail': 'x@x.com', Telefone: '1', UnknownField: 'foo' },
        allFields,
      ),
    ).resolves.not.toThrow();
    const [, data] = regRepo.updateAnswers.mock.calls[0];
    expect(data.answers).not.toHaveProperty('UnknownField');
  });

  it('syncs name/email/phone from fixed fields into the repository call, keyed by field id', async () => {
    const { service, regRepo } = makeService();
    const answers = { Nome: 'João', 'E-mail': 'joao@test.com', Telefone: '11999', Cidade: 'SP' };

    await service.updateAnswers('reg-1', 'evt-1', answers, allFields);

    expect(regRepo.updateAnswers).toHaveBeenCalledWith('reg-1', {
      answers: {
        [NOME_ID]: 'João',
        [EMAIL_ID]: 'joao@test.com',
        [TEL_ID]: '11999',
        [CIDADE_ID]: 'SP',
      },
      name: 'João',
      email: 'joao@test.com',
      phone: '11999',
    });
  });

  it('resolves required/fixed fields when the answer key case differs from the label', async () => {
    const { service, regRepo } = makeService();
    const answers = { nome: 'João', 'e-mail': 'joao@test.com', telefone: '11999' };

    await expect(
      service.updateAnswers('reg-1', 'evt-1', answers, allFields),
    ).resolves.not.toThrow();
    expect(regRepo.updateAnswers).toHaveBeenCalledWith('reg-1', {
      answers: { [NOME_ID]: 'João', [EMAIL_ID]: 'joao@test.com', [TEL_ID]: '11999' },
      name: 'João',
      email: 'joao@test.com',
      phone: '11999',
    });
  });

  it('omits fixed column keys when their label is absent from answers', async () => {
    const { service, regRepo } = makeService();
    // fields: only a non-required non-fixed field — no fixed fields present
    const fieldsNoFixed: FormFieldLike[] = [
      { id: CIDADE_ID, label: 'Cidade', type: 'text', required: false, isFixed: false },
    ];
    const answers = { Cidade: 'SP' };

    await service.updateAnswers('reg-1', 'evt-1', answers, fieldsNoFixed);

    expect(regRepo.updateAnswers).toHaveBeenCalledWith('reg-1', { answers: { [CIDADE_ID]: 'SP' } });
  });

  it('propagates the edited key to FormResponse via mergeAnswers when formId is given', async () => {
    const { service, formResponses } = makeService();
    const answers = { Nome: 'João', 'E-mail': 'joao@test.com', Telefone: '11999', Cidade: 'SP' };

    await service.updateAnswers('reg-1', 'evt-1', answers, allFields, 'form-1');

    expect(formResponses.mergeAnswers).toHaveBeenCalledWith('form-1', 'reg-1', {
      [NOME_ID]: 'João',
      [EMAIL_ID]: 'joao@test.com',
      [TEL_ID]: '11999',
      [CIDADE_ID]: 'SP',
    });
  });

  it('does not call mergeAnswers when formId is absent', async () => {
    const { service, formResponses } = makeService();
    const answers = { Nome: 'João', 'E-mail': 'joao@test.com', Telefone: '11999' };

    await service.updateAnswers('reg-1', 'evt-1', answers, allFields);

    expect(formResponses.mergeAnswers).not.toHaveBeenCalled();
  });
});
