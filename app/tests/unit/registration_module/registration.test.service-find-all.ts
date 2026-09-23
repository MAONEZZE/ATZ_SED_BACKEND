import { RegistrationService } from '@application/registration_module/registration.service';
import { RegistrationEntity } from '@domain/registration_module/registration.entity';

const DATE = new Date('2026-08-19T12:00:00Z');

function make(regs: RegistrationEntity[]) {
  const regRepo = {
    findAllByEventPaginated: jest.fn().mockResolvedValue({ data: regs, total: regs.length }),
  };
  const formFields = {
    listLabels: jest.fn().mockResolvedValue([{ id: 'field-cidade', label: 'Cidade' }]),
  };
  const service = new RegistrationService(
    regRepo as any,
    {} as any,
    { emit: jest.fn() } as any,
    {} as any,
    {} as any,
    {} as any,
    formFields as any,
    {} as any,
  );
  return { service };
}

function reg(originFormId: string | null, formName: string | null) {
  return new RegistrationEntity(
    'reg-1',
    'evt-1',
    'pending',
    { 'field-cidade': 'Recife' },
    'Ana',
    'ana@x.com',
    '+5581999990000',
    DATE,
    DATE,
    false,
    false,
    originFormId,
    formName,
  );
}

describe('RegistrationService.findAllPaginated', () => {
  it('mantém formName ao hidratar as respostas pelo formulário de origem', async () => {
    const { service } = make([reg('form-1', 'Inscrição VIP')]);

    const { data } = await service.findAllPaginated('evt-1', 1, 20);

    expect(data[0].formName).toBe('Inscrição VIP');
    expect(data[0].answers).toEqual({ Cidade: 'Recife' });
  });
});
