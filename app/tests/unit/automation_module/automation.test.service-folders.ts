import { NotFoundException } from '@nestjs/common';
import { AutomationService } from '@application/automation_module/automation.service';
import { AutomationRuleEntity } from '@domain/automation_module/automation-rule.entity';

const FOLDER = {
  id: 'fld-1',
  ownerId: 'user-1',
  resourceType: 'automation_rule' as const,
  eventId: 'evt-1',
};

function existingRule() {
  return new AutomationRuleEntity(
    'rule-1',
    'evt-1',
    'tpl-1',
    'on_registration',
    [],
    null,
    null,
    null,
    true,
    null,
    0,
    new Date('2026-08-17'),
  );
}

function make(folder: unknown = FOLDER) {
  const repo = {
    templateById: jest.fn().mockResolvedValue({ id: 'tpl-1' }),
    findActiveByEventTriggerAndTemplate: jest.fn().mockResolvedValue(null),
    findByEvent: jest.fn().mockResolvedValue(existingRule()),
    findAllByEventPaginated: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'rule-1', ...data })),
    update: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
    reorder: jest.fn().mockResolvedValue(undefined),
  };
  const scheduler = {
    upsert: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const forms = { findByIdAndEvent: jest.fn().mockResolvedValue({ id: 'form-1' }) };
  const folders = { findById: jest.fn().mockResolvedValue(folder) };
  const svc = new AutomationService(repo as any, scheduler as any, forms as any, folders as any);
  return { svc, repo, folders };
}

describe('AutomationService folderId', () => {
  it('stores the folder on create', async () => {
    const { svc, repo } = make();

    await svc.create('evt-1', {
      templateId: 'tpl-1',
      trigger: 'on_registration',
      folderId: 'fld-1',
    });

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ folderId: 'fld-1' }));
  });

  it('rejects a folder of another resource type', async () => {
    const { svc, repo } = make({ ...FOLDER, resourceType: 'message_template' });

    await expect(
      svc.create('evt-1', { templateId: 'tpl-1', trigger: 'on_registration', folderId: 'fld-1' }),
    ).rejects.toThrow(NotFoundException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  // Regra vive dentro do evento, então a pasta dela também.
  it('rejects a folder from another event', async () => {
    const { svc, repo } = make({ ...FOLDER, eventId: 'evt-9' });

    await expect(
      svc.create('evt-1', { templateId: 'tpl-1', trigger: 'on_registration', folderId: 'fld-1' }),
    ).rejects.toThrow(NotFoundException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('moves a rule between folders on update', async () => {
    const { svc, repo } = make();

    await svc.update('evt-1', 'rule-1', { folderId: 'fld-1' });

    expect(repo.update).toHaveBeenCalledWith('rule-1', { folderId: 'fld-1' });
  });

  it('clears the folder with an explicit null without a folder lookup', async () => {
    const { svc, repo, folders } = make();

    await svc.update('evt-1', 'rule-1', { folderId: null });

    expect(folders.findById).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith('rule-1', { folderId: null });
  });

  it('leaves the column alone when folderId is absent', async () => {
    const { svc, repo } = make();

    await svc.update('evt-1', 'rule-1', { active: false });

    expect(repo.update.mock.calls[0][1]).not.toHaveProperty('folderId');
  });
});

describe('AutomationService.listPaginated folder scope', () => {
  it('forwards the folder scope to the repository', async () => {
    const { svc, repo } = make();

    await svc.listPaginated('evt-1', 2, 10, null);

    expect(repo.findAllByEventPaginated).toHaveBeenCalledWith(
      'evt-1',
      { skip: 10, take: 10 },
      null,
    );
  });

  it('omits the folder scope when not given', async () => {
    const { svc, repo } = make();

    await svc.listPaginated('evt-1', 1, 20);

    expect(repo.findAllByEventPaginated).toHaveBeenCalledWith(
      'evt-1',
      { skip: 0, take: 20 },
      undefined,
    );
  });
});

describe('AutomationService.reorder', () => {
  it('reorders rules outside any folder without a folder lookup', async () => {
    const { svc, repo, folders } = make();

    await svc.reorder('evt-1', null, ['b', 'a']);

    expect(folders.findById).not.toHaveBeenCalled();
    expect(repo.reorder).toHaveBeenCalledWith('evt-1', null, ['b', 'a']);
  });

  it('checks the folder belongs to the event before reordering', async () => {
    const { svc, repo } = make({ ...FOLDER, eventId: 'evt-9' });

    await expect(svc.reorder('evt-1', 'fld-1', ['b'])).rejects.toThrow(NotFoundException);
    expect(repo.reorder).not.toHaveBeenCalled();
  });
});
