import { AutomationService } from '@application/automation_module/automation.service';
import {
  AutomationRuleEntity,
  AutomationTrigger,
} from '@domain/automation_module/automation-rule.entity';

function rule(trigger: AutomationTrigger, formId: string | null) {
  return new AutomationRuleEntity(
    'rule-1',
    'evt-1',
    'tpl-1',
    trigger,
    formId,
    null,
    null,
    null,
    true,
    null,
    0,
    new Date('2026-08-17'),
  );
}

function make(existing = rule('on_form_submitted', 'form-1')) {
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

describe('AutomationService.create formId', () => {
  it('sends the formId down to the repository', async () => {
    const { svc, repo } = make();

    await svc.create('evt-1', {
      templateId: 'tpl-1',
      trigger: 'on_form_submitted',
      formId: 'form-2',
    });

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ formId: 'form-2' }));
  });

  // `on_registration` aceita formulário como escopo opcional; os outros ignoram.
  it('drops the formId for a trigger that does not accept one', async () => {
    const { svc, repo } = make();

    await svc.create('evt-1', { templateId: 'tpl-1', trigger: 'on_approval', formId: 'form-2' });

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ formId: null }));
  });
});

describe('AutomationService.update formId', () => {
  it('writes the new formId', async () => {
    const { svc, repo } = make();

    await svc.update('evt-1', 'rule-1', { formId: 'form-2' });

    expect(repo.update).toHaveBeenCalledWith('rule-1', expect.objectContaining({ formId: 'form-2' }));
  });

  // Sem isso a coluna ficava com o formulário antigo sob um gatilho que o ignora,
  // sujando a chave de duplicata (trigger + template + formId).
  it('clears the formId when moving to a trigger that ignores it', async () => {
    const { svc, repo } = make(rule('on_form_submitted', 'form-1'));

    await svc.update('evt-1', 'rule-1', { trigger: 'on_approval' });

    expect(repo.update).toHaveBeenCalledWith(
      'rule-1',
      expect.objectContaining({ trigger: 'on_approval', formId: null }),
    );
  });

  it('keeps the formId when moving between triggers that accept one', async () => {
    const { svc, repo } = make(rule('on_form_submitted', 'form-1'));

    await svc.update('evt-1', 'rule-1', { trigger: 'on_registration' });

    expect(repo.update.mock.calls[0][1]).not.toHaveProperty('formId');
  });

  it('does not rewrite the column when nothing about the form changed', async () => {
    const { svc, repo } = make(rule('on_form_submitted', 'form-1'));

    await svc.update('evt-1', 'rule-1', { formId: 'form-1' });

    expect(repo.update.mock.calls[0][1]).not.toHaveProperty('formId');
  });
});
