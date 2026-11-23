import { BadRequestException } from '@nestjs/common';
import { FormFieldService } from '@application/form_field_module/form-field.service';

function makeService(
  existing: { id: string; label: string } | null = null,
  fieldType = 'text',
  activeRules: unknown[] = [],
) {
  const repo = {
    create: jest.fn().mockResolvedValue({ id: 'f-new' }),
    update: jest.fn().mockResolvedValue({ id: 'f1' }),
    delete: jest.fn().mockResolvedValue(undefined),
    findByEvent: jest.fn().mockResolvedValue({
      id: 'f1',
      formId: 'form-1',
      label: 'Campo',
      type: fieldType,
      options: null,
    }),
    findByFormAndType: jest.fn().mockResolvedValue(existing),
    findAllByEventPaginated: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    touchEvent: jest.fn().mockResolvedValue(undefined),
  };
  const eventsService = { findById: jest.fn().mockResolvedValue({ isEditable: () => true }) };
  const formsService = { findOne: jest.fn().mockResolvedValue({ id: 'form-1' }) };
  const automations = { findActiveTriggerRules: jest.fn().mockResolvedValue(activeRules) };
  return {
    service: new FormFieldService(
      repo as any,
      eventsService as any,
      formsService as any,
      automations as any,
    ),
    repo,
    automations,
  };
}

describe('FormFieldService — no máximo 1 campo name por formulário', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejeita criar o 2º campo name com 400 citando o label do existente', async () => {
    const { service, repo } = makeService({ id: 'f-old', label: 'Nome completo' });
    await expect(
      service.create('evt-1', 'user-1', {
        formId: 'form-1',
        label: 'Nome do aluno',
        type: 'name',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create('evt-1', 'user-1', {
        formId: 'form-1',
        label: 'Nome do aluno',
        type: 'name',
      }),
    ).rejects.toThrow('Nome completo');
    expect(repo.findByFormAndType).toHaveBeenCalledWith('form-1', 'name', undefined);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejeita trocar o tipo de outro campo para name quando o formulário já tem um', async () => {
    const { service, repo } = makeService({ id: 'f-old', label: 'Nome completo' });
    await expect(service.update('evt-1', 'f1', 'user-1', { type: 'name' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.update('evt-1', 'f1', 'user-1', { type: 'name' })).rejects.toThrow(
      'Nome completo',
    );
    expect(repo.findByFormAndType).toHaveBeenCalledWith('form-1', 'name', 'f1');
    expect(repo.update).not.toHaveBeenCalled();
  });
});
