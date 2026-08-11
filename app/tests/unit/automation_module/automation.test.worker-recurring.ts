import { RecurringAutomationsWorker } from '@application/workers/recurring-automations.worker';

function make() {
  const automations = {
    findAllRecurringActive: jest.fn(),
    findById: jest.fn(),
  };
  const eventRepo = { findWithApprovedRegistrationIds: jest.fn() };
  const engine = { fireAutomations: jest.fn().mockResolvedValue(undefined) };
  const scheduler = { syncAll: jest.fn().mockResolvedValue(undefined) };
  const worker = new RecurringAutomationsWorker(
    automations as any,
    eventRepo as any,
    engine as any,
    scheduler as any,
  );
  return { worker, automations, eventRepo, engine, scheduler };
}

describe('RecurringAutomationsWorker', () => {
  beforeEach(() => jest.clearAllMocks());

  it('onModuleInit syncs the scheduler with active recurring rules', async () => {
    const { worker, automations, scheduler } = make();
    automations.findAllRecurringActive.mockResolvedValue([
      { id: 'r1', cron: '0 9 * * 1', timezone: 'America/Sao_Paulo' },
    ]);

    await worker.onModuleInit();

    expect(automations.findAllRecurringActive).toHaveBeenCalled();
    expect(scheduler.syncAll).toHaveBeenCalledWith([
      { id: 'r1', cron: '0 9 * * 1', timezone: 'America/Sao_Paulo' },
    ]);
  });

  it('process fires the automation for every approved registration', async () => {
    const { worker, automations, eventRepo, engine } = make();
    automations.findById.mockResolvedValue({
      id: 'rule-1',
      eventId: 'evt-1',
      active: true,
      trigger: 'recurring',
    });
    eventRepo.findWithApprovedRegistrationIds.mockResolvedValue({
      id: 'evt-1',
      registrationIds: ['reg-1', 'reg-2'],
    });

    await worker.process({ data: { ruleId: 'rule-1' } } as any);

    expect(engine.fireAutomations).toHaveBeenCalledWith('reg-1', 'evt-1', 'recurring', ['rule-1']);
    expect(engine.fireAutomations).toHaveBeenCalledWith('reg-2', 'evt-1', 'recurring', ['rule-1']);
    expect(engine.fireAutomations).toHaveBeenCalledTimes(2);
  });

  it('process skips when the rule no longer exists', async () => {
    const { worker, automations, engine } = make();
    automations.findById.mockResolvedValue(null);

    await worker.process({ data: { ruleId: 'gone' } } as any);

    expect(engine.fireAutomations).not.toHaveBeenCalled();
  });

  it('process skips when the rule is inactive', async () => {
    const { worker, automations, engine } = make();
    automations.findById.mockResolvedValue({
      id: 'rule-1',
      eventId: 'evt-1',
      active: false,
      trigger: 'recurring',
    });

    await worker.process({ data: { ruleId: 'rule-1' } } as any);

    expect(engine.fireAutomations).not.toHaveBeenCalled();
  });

  it('process skips when the rule trigger is no longer recurring', async () => {
    const { worker, automations, engine } = make();
    automations.findById.mockResolvedValue({
      id: 'rule-1',
      eventId: 'evt-1',
      active: true,
      trigger: 'on_registration',
    });

    await worker.process({ data: { ruleId: 'rule-1' } } as any);

    expect(engine.fireAutomations).not.toHaveBeenCalled();
  });

  it('process continues to the next registration when one fireAutomations call throws', async () => {
    const { worker, automations, eventRepo, engine } = make();
    automations.findById.mockResolvedValue({
      id: 'rule-1',
      eventId: 'evt-1',
      active: true,
      trigger: 'recurring',
    });
    eventRepo.findWithApprovedRegistrationIds.mockResolvedValue({
      id: 'evt-1',
      registrationIds: ['reg-1', 'reg-2'],
    });
    engine.fireAutomations.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);

    await worker.process({ data: { ruleId: 'rule-1' } } as any);

    expect(engine.fireAutomations).toHaveBeenCalledTimes(2);
  });
});
