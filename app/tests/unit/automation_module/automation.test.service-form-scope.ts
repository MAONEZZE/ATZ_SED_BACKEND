import { BadRequestException } from '@nestjs/common';
import { AutomationService } from '@application/automation_module/automation.service';
import {
  AutomationRuleEntity,
  AutomationTrigger,
} from '@domain/automation_module/automation-rule.entity';

function rule(trigger: AutomationTrigger, formIds: string[]) {
  return new AutomationRuleEntity(
    'rule-1',
    'evt-1',
    'tpl-1',
    trigger,
    formIds,
    null,
    null,
    null,
    true,
    null,
    0,
    new Date('2026-08-17'),
  );
}

function make(existing = rule('on_form_submitted', ['form-1'])) {
  const repo = {
    templateById: jest.fn().mockResolvedValue({ id: 'tpl-1' }),
    findActiveByEventTriggerAndTemplate: jest.fn().mockResolvedValue(null),
    findByEvent: jest.fn().mockResolvedValue(existing),
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'rule-1', ...data })),
    update: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
  };
  const scheduler = {
    upsert: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const forms = { findByIdAndEvent: jest.fn().mockResolvedValue({ id: 'form-2' }) };
  const folders = { findById: jest.fn().mockResolvedValue(null) };
  const svc = new AutomationService(repo as any, scheduler as any, forms as any, folders as any);
  return { svc, repo, forms };
}

describe('AutomationService.create formIds', () => {
  it('sends the formIds down to the repository', async () => {
    const { svc, repo } = make();

    await svc.create('evt-1', {
      templateId: 'tpl-1',
      trigger: 'on_form_submitted',
      formIds: ['form-2'],
    });

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ formIds: ['form-2'] }));
  });

  // `on_registration` aceita formulário como escopo opcional; os outros ignoram.
  it('empties formIds for a trigger that does not accept one', async () => {
    const { svc, repo } = make();

    await svc.create('evt-1', {
      templateId: 'tpl-1',
      trigger: 'on_approval',
      formIds: ['form-2'],
    });

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ formIds: [] }));
  });

  it('validates every formId belongs to the event', async () => {
    const { svc, forms } = make();

    await svc.create('evt-1', {
      templateId: 'tpl-1',
      trigger: 'on_form_submitted',
      formIds: ['form-2', 'form-3'],
    });

    expect(forms.findByIdAndEvent).toHaveBeenCalledWith('form-2', 'evt-1');
    expect(forms.findByIdAndEvent).toHaveBeenCalledWith('form-3', 'evt-1');
  });
});

describe('AutomationService.update formIds', () => {
  it('writes the new formIds', async () => {
    const { svc, repo } = make();

    await svc.update('evt-1', 'rule-1', { formIds: ['form-2'] });

    expect(repo.update).toHaveBeenCalledWith(
      'rule-1',
      expect.objectContaining({ formIds: ['form-2'] }),
    );
  });

  // Sem isso a junção ficava com o formulário antigo sob um gatilho que o
  // ignora, sujando a regra.
  it('clears the formIds when moving to a trigger that ignores it', async () => {
    const { svc, repo } = make(rule('on_form_submitted', ['form-1']));

    await svc.update('evt-1', 'rule-1', { trigger: 'on_approval' });

    expect(repo.update).toHaveBeenCalledWith(
      'rule-1',
      expect.objectContaining({ trigger: 'on_approval', formIds: [] }),
    );
  });

  it('keeps the formIds when moving between triggers that accept one', async () => {
    const { svc, repo } = make(rule('on_form_submitted', ['form-1']));

    await svc.update('evt-1', 'rule-1', { trigger: 'on_registration' });

    expect(repo.update.mock.calls[0][1]).not.toHaveProperty('formIds');
  });

  it('does not rewrite the join when nothing about the forms changed', async () => {
    const { svc, repo } = make(rule('on_form_submitted', ['form-1']));

    await svc.update('evt-1', 'rule-1', { formIds: ['form-1'] });

    expect(repo.update.mock.calls[0][1]).not.toHaveProperty('formIds');
  });

  // Ordem não importa: mesmo conjunto, mesma junção.
  it('does not rewrite the join when the same set is sent in a different order', async () => {
    const { svc, repo } = make(rule('on_form_submitted', ['form-1', 'form-2']));

    await svc.update('evt-1', 'rule-1', { formIds: ['form-2', 'form-1'] });

    expect(repo.update.mock.calls[0][1]).not.toHaveProperty('formIds');
  });
});

// Formulário anônimo nunca dispara form.submitted (submitForm nem emite o
// evento nesse caminho) — a regra tem que ser recusada na origem.
describe('AutomationService — formulário anônimo', () => {
  function makeWithAnonymousForm() {
    const repo = {
      templateById: jest.fn().mockResolvedValue({ id: 'tpl-1' }),
      findActiveByEventTriggerAndTemplate: jest.fn().mockResolvedValue(null),
      findByEvent: jest.fn().mockResolvedValue(rule('on_form_submitted', ['form-1'])),
      create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'rule-1', ...data })),
      update: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
    };
    const scheduler = { upsert: jest.fn(), remove: jest.fn() };
    const forms = {
      findByIdAndEvent: jest
        .fn()
        .mockResolvedValue({ id: 'form-2', name: 'Voto', anonymous: true }),
    };
    const folders = { findById: jest.fn().mockResolvedValue(null) };
    const svc = new AutomationService(repo as any, scheduler as any, forms as any, folders as any);
    return { svc, repo };
  }

  it('400s creating an on_form_submitted rule scoped to an anonymous form', async () => {
    const { svc, repo } = makeWithAnonymousForm();

    await expect(
      svc.create('evt-1', {
        templateId: 'tpl-1',
        trigger: 'on_form_submitted',
        formIds: ['form-2'],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('400s updating a rule to scope on_form_submitted to an anonymous form', async () => {
    const { svc, repo } = makeWithAnonymousForm();

    await expect(svc.update('evt-1', 'rule-1', { formIds: ['form-2'] })).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });
});
