import { AutomationsService } from '@modules/automations/automations.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

function make() {
  const repo = {
    templateById: jest.fn().mockResolvedValue({ id: 'tpl-1' }),
    findActiveByEventAndTrigger: jest.fn().mockResolvedValue(null),
    findByEvent: jest.fn(),
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'rule-1', ...data })),
    update: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const scheduler = {
    upsert: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    syncAll: jest.fn().mockResolvedValue(undefined),
  };
  const svc = new AutomationsService(repo as any, scheduler as any);
  return { svc, repo, scheduler };
}

describe('AutomationsService — recurring trigger', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects creating a recurring rule without cron', async () => {
    const { svc } = make();
    await expect(
      svc.create('evt-1', { templateId: 'tpl-1', trigger: 'recurring', timezone: 'America/Sao_Paulo' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects creating a recurring rule without timezone', async () => {
    const { svc } = make();
    await expect(
      svc.create('evt-1', { templateId: 'tpl-1', trigger: 'recurring', cron: '0 9 * * 1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a recurring rule and registers the scheduler', async () => {
    const { svc, repo, scheduler } = make();
    const rule = await svc.create('evt-1', {
      templateId: 'tpl-1',
      trigger: 'recurring',
      cron: '0 9 * * 1',
      timezone: 'America/Sao_Paulo',
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ cron: '0 9 * * 1', timezone: 'America/Sao_Paulo' }),
    );
    expect(scheduler.upsert).toHaveBeenCalledWith({
      id: 'rule-1',
      cron: '0 9 * * 1',
      timezone: 'America/Sao_Paulo',
    });
    expect(rule).toMatchObject({ id: 'rule-1' });
  });

  it('does not check for active duplicates when creating a recurring rule', async () => {
    const { svc, repo } = make();
    await svc.create('evt-1', {
      templateId: 'tpl-1',
      trigger: 'recurring',
      cron: '0 9 * * 1',
      timezone: 'America/Sao_Paulo',
    });
    expect(repo.findActiveByEventAndTrigger).not.toHaveBeenCalled();
  });

  it('still checks for active duplicates on non-recurring triggers', async () => {
    const { svc, repo } = make();
    await svc.create('evt-1', { templateId: 'tpl-1', trigger: 'on_registration' });
    expect(repo.findActiveByEventAndTrigger).toHaveBeenCalledWith('evt-1', 'on_registration', undefined);
  });

  it('rejects an active duplicate for a non-recurring trigger', async () => {
    const { svc, repo } = make();
    repo.findActiveByEventAndTrigger.mockResolvedValue({ id: 'existing' });
    await expect(
      svc.create('evt-1', { templateId: 'tpl-1', trigger: 'on_registration' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not register a scheduler for an inactive recurring rule', async () => {
    const { svc, scheduler } = make();
    await svc.create('evt-1', {
      templateId: 'tpl-1',
      trigger: 'recurring',
      cron: '0 9 * * 1',
      timezone: 'America/Sao_Paulo',
      active: false,
    });
    expect(scheduler.upsert).not.toHaveBeenCalled();
    expect(scheduler.remove).toHaveBeenCalledWith('rule-1');
  });

  // repo.update (Prisma) always returns the full row, not just the patched
  // fields — mirror that here instead of the generic `make()` mock which
  // only spreads the patch.
  function mockFullRowUpdate(repo: ReturnType<typeof make>['repo'], existing: Record<string, unknown>) {
    repo.update.mockImplementation((id: string, data: Record<string, unknown>) =>
      Promise.resolve({ ...existing, id, ...data }),
    );
  }

  it('update: removes the scheduler when deactivating a recurring rule', async () => {
    const { svc, repo, scheduler } = make();
    const existing = {
      id: 'rule-1',
      trigger: 'recurring',
      active: true,
      cron: '0 9 * * 1',
      timezone: 'America/Sao_Paulo',
    };
    repo.findByEvent.mockResolvedValue(existing);
    mockFullRowUpdate(repo, existing);

    await svc.update('evt-1', 'rule-1', { active: false });

    expect(scheduler.remove).toHaveBeenCalledWith('rule-1');
    expect(scheduler.upsert).not.toHaveBeenCalled();
  });

  it('update: re-upserts the scheduler when changing the cron of an active recurring rule', async () => {
    const { svc, repo, scheduler } = make();
    const existing = {
      id: 'rule-1',
      trigger: 'recurring',
      active: true,
      cron: '0 9 * * 1',
      timezone: 'America/Sao_Paulo',
    };
    repo.findByEvent.mockResolvedValue(existing);
    mockFullRowUpdate(repo, existing);

    await svc.update('evt-1', 'rule-1', { cron: '0 10 * * 2' });

    expect(scheduler.upsert).toHaveBeenCalledWith({
      id: 'rule-1',
      cron: '0 10 * * 2',
      timezone: 'America/Sao_Paulo',
    });
  });

  it('update: removes the scheduler when trigger changes away from recurring', async () => {
    const { svc, repo, scheduler } = make();
    const existing = {
      id: 'rule-1',
      trigger: 'recurring',
      active: true,
      cron: '0 9 * * 1',
      timezone: 'America/Sao_Paulo',
    };
    repo.findByEvent.mockResolvedValue(existing);
    mockFullRowUpdate(repo, existing);

    await svc.update('evt-1', 'rule-1', { trigger: 'on_registration' });

    expect(scheduler.remove).toHaveBeenCalledWith('rule-1');
    expect(scheduler.upsert).not.toHaveBeenCalled();
  });

  it('update: throws NotFoundException when the rule does not exist', async () => {
    const { svc, repo } = make();
    repo.findByEvent.mockResolvedValue(null);
    await expect(svc.update('evt-1', 'missing', { active: false })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('delete: removes the scheduler when deleting a recurring rule', async () => {
    const { svc, repo, scheduler } = make();
    repo.findByEvent.mockResolvedValue({ id: 'rule-1', trigger: 'recurring' });

    await svc.delete('evt-1', 'rule-1');

    expect(repo.delete).toHaveBeenCalledWith('rule-1');
    expect(scheduler.remove).toHaveBeenCalledWith('rule-1');
  });

  it('delete: does not touch the scheduler for a non-recurring rule', async () => {
    const { svc, repo, scheduler } = make();
    repo.findByEvent.mockResolvedValue({ id: 'rule-1', trigger: 'on_registration' });

    await svc.delete('evt-1', 'rule-1');

    expect(scheduler.remove).not.toHaveBeenCalled();
  });
});
