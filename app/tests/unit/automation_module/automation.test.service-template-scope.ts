import { NotFoundException } from '@nestjs/common';
import { AutomationService } from '@application/automation_module/automation.service';
import { AutomationRuleEntity } from '@domain/automation_module/automation-rule.entity';

// `templateById(templateId, eventId)` só devolve o template quando ele é do
// próprio evento — a query do repo já filtra global e de outro evento fora.
// Aqui simulamos isso: `null` representa "não é deste evento" (global ou de
// outro evento), sem distinguir os dois casos — o service trata igual: 404.
function make(templateById: jest.Mock) {
  const existing = new AutomationRuleEntity(
    'rule-1',
    'evt-1',
    'tpl-own',
    'on_approval',
    [],
    null,
    null,
    null,
    true,
    null,
    0,
    new Date('2026-08-17'),
  );
  const repo = {
    templateById,
    findActiveByEventTriggerAndTemplate: jest.fn().mockResolvedValue(null),
    findByEvent: jest.fn().mockResolvedValue(existing),
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'rule-new', ...data })),
    update: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
  };
  const scheduler = { upsert: jest.fn(), remove: jest.fn() };
  const forms = { findByIdAndEvent: jest.fn() };
  const folders = { findById: jest.fn().mockResolvedValue(null) };
  const formFields = { findByFormAndType: jest.fn() };
  const svc = new AutomationService(
    repo as any,
    scheduler as any,
    forms as any,
    folders as any,
    formFields as any,
  );
  return { svc, repo };
}

describe('AutomationService — automação só usa template do próprio evento', () => {
  it('404s creating with a global template', async () => {
    const { svc, repo } = make(jest.fn().mockResolvedValue(null));

    await expect(
      svc.create('evt-1', { templateId: 'tpl-global', trigger: 'on_approval' }),
    ).rejects.toThrow(NotFoundException);
    expect(repo.templateById).toHaveBeenCalledWith('tpl-global', 'evt-1');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('404s creating with a template that belongs to another event', async () => {
    const { svc, repo } = make(jest.fn().mockResolvedValue(null));

    await expect(
      svc.create('evt-1', { templateId: 'tpl-other-event', trigger: 'on_approval' }),
    ).rejects.toThrow(NotFoundException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('creates fine with a template that belongs to the event', async () => {
    const { svc, repo } = make(jest.fn().mockResolvedValue({ id: 'tpl-own' }));

    await svc.create('evt-1', { templateId: 'tpl-own', trigger: 'on_approval' });

    expect(repo.create).toHaveBeenCalled();
  });

  it('404s a PATCH that moves templateId to a global template', async () => {
    const { svc, repo } = make(jest.fn().mockResolvedValue(null));

    await expect(svc.update('evt-1', 'rule-1', { templateId: 'tpl-global' })).rejects.toThrow(
      NotFoundException,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('404s a PATCH that moves templateId to a template from another event', async () => {
    const { svc, repo } = make(jest.fn().mockResolvedValue(null));

    await expect(svc.update('evt-1', 'rule-1', { templateId: 'tpl-other-event' })).rejects.toThrow(
      NotFoundException,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('updates fine when templateId stays a template of the event', async () => {
    const { svc, repo } = make(jest.fn().mockResolvedValue({ id: 'tpl-own' }));

    await svc.update('evt-1', 'rule-1', { templateId: 'tpl-own' });

    expect(repo.update).toHaveBeenCalled();
  });
});
