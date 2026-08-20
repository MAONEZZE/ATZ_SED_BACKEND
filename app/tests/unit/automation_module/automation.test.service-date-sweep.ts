import { DateAutomationsService } from '@application/automation_module/date-automations.service';

const SEND_AT = new Date('2027-02-12T12:00:00Z');

function make(due: Array<{ id: string; eventId: string; sendAt: Date }>) {
  const automations = { claimDueDateRules: jest.fn().mockResolvedValue(due) };
  const eventRepo = {
    findWithApprovedRegistrationIds: jest
      .fn()
      .mockResolvedValue({ id: 'evt-1', registrationIds: ['reg-1', 'reg-2'] }),
  };
  const engine = { fireAutomations: jest.fn().mockResolvedValue(undefined) };
  const svc = new DateAutomationsService(automations as any, eventRepo as any, engine as any);
  return { svc, automations, eventRepo, engine };
}

describe('DateAutomationsService.sweep', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fires the rule for every approved registration of the event', async () => {
    const { svc, engine } = make([{ id: 'rule-1', eventId: 'evt-1', sendAt: SEND_AT }]);

    await svc.sweep();

    // O sendAt vai como occurrenceKey: é o que entra no dedupKey do outbox.
    expect(engine.fireAutomations).toHaveBeenCalledTimes(2);
    expect(engine.fireAutomations).toHaveBeenCalledWith(
      'reg-1',
      'evt-1',
      'on_date',
      ['rule-1'],
      '2027-02-12T12:00:00.000Z',
    );
    expect(engine.fireAutomations).toHaveBeenCalledWith(
      'reg-2',
      'evt-1',
      'on_date',
      ['rule-1'],
      '2027-02-12T12:00:00.000Z',
    );
  });

  it('does nothing when no rule is due', async () => {
    const { svc, eventRepo, engine } = make([]);

    await svc.sweep();

    expect(eventRepo.findWithApprovedRegistrationIds).not.toHaveBeenCalled();
    expect(engine.fireAutomations).not.toHaveBeenCalled();
  });

  // A regra já foi marcada como disparada no claim: abortar o sweep por causa de
  // um inscrito perderia os outros para sempre.
  it('keeps going when one registration fails', async () => {
    const { svc, engine } = make([{ id: 'rule-1', eventId: 'evt-1', sendAt: SEND_AT }]);
    engine.fireAutomations.mockRejectedValueOnce(new Error('uazapi down'));

    await expect(svc.sweep()).resolves.toBeUndefined();

    expect(engine.fireAutomations).toHaveBeenCalledTimes(2);
  });

  it('skips a rule whose event vanished and still processes the next one', async () => {
    const { svc, eventRepo, engine } = make([
      { id: 'rule-1', eventId: 'evt-morto', sendAt: SEND_AT },
      { id: 'rule-2', eventId: 'evt-1', sendAt: SEND_AT },
    ]);
    eventRepo.findWithApprovedRegistrationIds.mockResolvedValueOnce(null);

    await svc.sweep();

    expect(engine.fireAutomations).toHaveBeenCalledTimes(2);
    expect(engine.fireAutomations).toHaveBeenCalledWith(
      'reg-1',
      'evt-1',
      'on_date',
      ['rule-2'],
      expect.any(String),
    );
  });
});
