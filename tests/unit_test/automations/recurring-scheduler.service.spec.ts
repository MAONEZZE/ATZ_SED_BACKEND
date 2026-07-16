import { RecurringSchedulerService } from '@modules/automations/recurring-scheduler.service';

function make(existingSchedulers: Array<{ key: string }> = []) {
  const queue = {
    upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
    removeJobScheduler: jest.fn().mockResolvedValue(true),
    getJobSchedulers: jest.fn().mockResolvedValue(existingSchedulers),
  };
  const svc = new RecurringSchedulerService(queue as any);
  return { svc, queue };
}

describe('RecurringSchedulerService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('upsert registers a job scheduler keyed by rule id with pattern+tz', async () => {
    const { svc, queue } = make();
    await svc.upsert({ id: 'rule-1', cron: '0 9 * * 1', timezone: 'America/Sao_Paulo' });

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'recurring-rule:rule-1',
      { pattern: '0 9 * * 1', tz: 'America/Sao_Paulo' },
      { name: 'fire', data: { ruleId: 'rule-1' } },
    );
  });

  it('remove removes the job scheduler keyed by rule id', async () => {
    const { svc, queue } = make();
    await svc.remove('rule-1');
    expect(queue.removeJobScheduler).toHaveBeenCalledWith('recurring-rule:rule-1');
  });

  it('syncAll upserts every active rule with a usable cron+timezone', async () => {
    const { svc, queue } = make();
    await svc.syncAll([
      { id: 'r1', cron: '0 9 * * 1', timezone: 'America/Sao_Paulo' },
      { id: 'r2', cron: null, timezone: null },
    ]);

    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(1);
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'recurring-rule:r1',
      { pattern: '0 9 * * 1', tz: 'America/Sao_Paulo' },
      { name: 'fire', data: { ruleId: 'r1' } },
    );
  });

  it('syncAll removes orphaned schedulers whose rule is no longer active', async () => {
    const { svc, queue } = make([
      { key: 'recurring-rule:r1' },
      { key: 'recurring-rule:deleted-rule' },
      { key: 'scheduled-automations-recurring' },
    ]);

    await svc.syncAll([{ id: 'r1', cron: '0 9 * * 1', timezone: 'America/Sao_Paulo' }]);

    expect(queue.removeJobScheduler).toHaveBeenCalledTimes(1);
    expect(queue.removeJobScheduler).toHaveBeenCalledWith('recurring-rule:deleted-rule');
  });
});
