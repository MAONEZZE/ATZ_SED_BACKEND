import { BadRequestException } from '@nestjs/common';
import { FormFieldService } from '@application/form_field_module/form-field.service';

function makeService(existing: { id: string; label: string } | null = null) {
  const repo = {
    create: jest.fn().mockResolvedValue({ id: 'f-new' }),
    update: jest.fn().mockResolvedValue({ id: 'f1' }),
    delete: jest.fn().mockResolvedValue(undefined),
    findByEvent: jest
      .fn()
      .mockResolvedValue({ id: 'f1', label: 'Campo', type: 'text', options: null }),
    findByEventAndType: jest.fn().mockResolvedValue(existing),
    findAllByEventPaginated: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    touchEvent: jest.fn().mockResolvedValue(undefined),
  };
  const eventsService = { findById: jest.fn().mockResolvedValue({ isEditable: () => true }) };
  const formsService = { findOne: jest.fn().mockResolvedValue({ id: 'form-1' }) };
  return {
    service: new FormFieldService(repo as any, eventsService as any, formsService as any),
    repo,
  };
}

describe('FormFieldService — no máximo 1 campo on_date_automation_field por evento', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cria o 1º campo sem consultar duplicata bloqueante', async () => {
    const { service, repo } = makeService(null);
    await expect(
      service.create('evt-1', 'user-1', {
        formId: 'form-1',
        label: 'Dia da mensalidade',
        type: 'on_date_automation_field',
      }),
    ).resolves.not.toThrow();
    expect(repo.create).toHaveBeenCalled();
  });

  it('rejeita o 2º campo com 400 citando o label do existente', async () => {
    const { service } = makeService({ id: 'f-old', label: 'Dia da mensalidade' });
    await expect(
      service.create('evt-1', 'user-1', {
        formId: 'form-1',
        label: 'Outro campo de data',
        type: 'on_date_automation_field',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create('evt-1', 'user-1', {
        formId: 'form-1',
        label: 'Outro campo de data',
        type: 'on_date_automation_field',
      }),
    ).rejects.toThrow('Dia da mensalidade');
  });

  it('rejeita trocar o tipo de outro campo para on_date_automation_field quando já existe um', async () => {
    const { service } = makeService({ id: 'f-old', label: 'Dia da mensalidade' });
    await expect(
      service.update('evt-1', 'f1', 'user-1', { type: 'on_date_automation_field' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('PATCH no próprio campo (excludeId = ele mesmo) passa mesmo já sendo o único', async () => {
    const { service, repo } = makeService(null); // findByEventAndType já exclui o próprio id
    await expect(
      service.update('evt-1', 'f1', 'user-1', { type: 'on_date_automation_field' }),
    ).resolves.not.toThrow();
    expect(repo.findByEventAndType).toHaveBeenCalledWith('evt-1', 'on_date_automation_field', 'f1');
  });

  it('campo do tipo text com outro campo de data automação já existente passa (não é o tipo em questão)', async () => {
    const { service, repo } = makeService({ id: 'f-old', label: 'Dia da mensalidade' });
    await expect(
      service.update('evt-1', 'f1', 'user-1', { type: 'text' }),
    ).resolves.not.toThrow();
    expect(repo.findByEventAndType).not.toHaveBeenCalled();
  });

  it('PATCH sem type não consulta o banco', async () => {
    const { service, repo } = makeService({ id: 'f-old', label: 'Dia da mensalidade' });
    await service.update('evt-1', 'f1', 'user-1', { label: 'Novo label' });
    expect(repo.findByEventAndType).not.toHaveBeenCalled();
  });
});
