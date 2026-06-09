import { RegistrationsService } from '../../app/services/registrations/registrations.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

type FormFieldLike = { label: string; type: string; required: boolean; isFixed: boolean };

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
    updateAnswers: jest.fn().mockResolvedValue({ ...reg, answers: { Nome: 'New' } }),
    updateStatus: jest.fn(),
    create: jest.fn(),
    findAllByEvent: jest.fn(),
    findAllByEventPaginated: jest.fn(),
  };
  const eventsService = { findBySlug: jest.fn(), findById: jest.fn() };
  const eventEmitter = { emit: jest.fn() };
  const service = new RegistrationsService(
    regRepo as any,
    eventsService as any,
    eventEmitter as any,
  );
  return { service, regRepo };
}

const allFields: FormFieldLike[] = [
  { label: 'Nome', type: 'text', required: true, isFixed: true },
  { label: 'E-mail', type: 'email', required: true, isFixed: true },
  { label: 'Telefone', type: 'phone', required: true, isFixed: true },
  { label: 'Cidade', type: 'text', required: false, isFixed: false },
];

describe('RegistrationsService.updateAnswers', () => {
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

  it('accepts extra unknown keys in answers without error', async () => {
    const { service } = makeService();
    await expect(
      service.updateAnswers(
        'reg-1',
        'evt-1',
        { Nome: 'X', 'E-mail': 'x@x.com', Telefone: '1', UnknownField: 'foo' },
        allFields,
      ),
    ).resolves.not.toThrow();
  });

  it('syncs name/email/phone from fixed fields into the repository call', async () => {
    const { service, regRepo } = makeService();
    const answers = { Nome: 'João', 'E-mail': 'joao@test.com', Telefone: '11999', Cidade: 'SP' };

    await service.updateAnswers('reg-1', 'evt-1', answers, allFields);

    expect(regRepo.updateAnswers).toHaveBeenCalledWith('reg-1', {
      answers,
      name: 'João',
      email: 'joao@test.com',
      phone: '11999',
    });
  });

  it('omits fixed column keys when their label is absent from answers', async () => {
    const { service, regRepo } = makeService();
    // fields: only a non-required non-fixed field — no fixed fields present
    const fieldsNoFixed: FormFieldLike[] = [
      { label: 'Cidade', type: 'text', required: false, isFixed: false },
    ];
    const answers = { Cidade: 'SP' };

    await service.updateAnswers('reg-1', 'evt-1', answers, fieldsNoFixed);

    expect(regRepo.updateAnswers).toHaveBeenCalledWith('reg-1', { answers });
  });
});
