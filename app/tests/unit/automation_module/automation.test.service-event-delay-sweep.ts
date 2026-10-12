import { EventDelayAutomationsService } from '@application/automation_module/event-delay-automations.service';
import { EventDelayCandidate } from '@domain/automation_module/i-repository-automation';

const EVENT = new Date('2027-03-10T22:00:00Z');

function candidate(over: Partial<EventDelayCandidate> = {}): EventDelayCandidate {
  return {
    id: 'rule-1',
    eventId: 'evt-1',
    formIds: [],
    firedForAt: null,
    delay: { direction: 'before', value: 2, unit: 'hours' }, // fireAt = 20:00Z
    event: { eventDate: EVENT, endDate: null },
    ...over,
  };
}

function make(cands: EventDelayCandidate[]) {
  const automations = {
    findEventDelayCandidates: jest.fn().mockResolvedValue(cands),
    markEventDelayRuleFired: jest.fn().mockResolvedValue(undefined),
  };
  const eventRepo = {
    findWithApprovedRegistrationIds: jest
      .fn()
      .mockResolvedValue({ id: 'evt-1', registrationIds: ['reg-1', 'reg-2'] }),
  };
  const engine = { fireAutomations: jest.fn().mockResolvedValue(undefined) };
  const svc = new EventDelayAutomationsService(automations as any, eventRepo as any, engine as any);
  return { svc, automations, eventRepo, engine };
}

const at = (iso: string) => jest.useFakeTimers().setSystemTime(new Date(iso));

afterEach(() => jest.useRealTimers());

describe('EventDelayAutomationsService.sweep — disparo básico', () => {
  it('does nothing before the fire moment', async () => {
    at('2027-03-10T19:59:00Z');
    const { svc, engine, automations } = make([candidate()]);

    await svc.sweep();

    expect(engine.fireAutomations).not.toHaveBeenCalled();
    expect(automations.markEventDelayRuleFired).not.toHaveBeenCalled();
  });

  it('fires every approved registration with the fire moment as occurrenceKey, then marks', async () => {
    at('2027-03-10T20:01:00Z');
    const { svc, engine, automations } = make([candidate()]);

    await svc.sweep();

    for (const reg of ['reg-1', 'reg-2']) {
      expect(engine.fireAutomations).toHaveBeenCalledWith(
        reg,
        'evt-1',
        'on_event_delay',
        ['rule-1'],
        '2027-03-10T20:00:00.000Z',
      );
    }
    expect(automations.markEventDelayRuleFired).toHaveBeenCalledWith(
      'rule-1',
      new Date('2027-03-10T20:00:00Z'),
    );
  });

  it('counts "after" from endDate', async () => {
    at('2027-03-11T03:01:00Z');
    const { svc, engine } = make([
      candidate({
        delay: { direction: 'after', value: 1, unit: 'hours' },
        event: { eventDate: EVENT, endDate: new Date('2027-03-11T02:00:00Z') },
      }),
    ]);

    await svc.sweep();

    expect(engine.fireAutomations).toHaveBeenCalledWith(
      'reg-1',
      'evt-1',
      'on_event_delay',
      ['rule-1'],
      '2027-03-11T03:00:00.000Z',
    );
  });

  it('passes the rule formIds to findWithApprovedRegistrationIds', async () => {
    at('2027-03-10T20:01:00Z');
    const { svc, eventRepo } = make([candidate({ formIds: ['form-b'] })]);

    await svc.sweep();

    expect(eventRepo.findWithApprovedRegistrationIds).toHaveBeenCalledWith('evt-1', ['form-b']);
  });

  it('skips a candidate whose event has no eventDate', async () => {
    at('2027-03-10T20:01:00Z');
    const { svc, engine, automations } = make([
      candidate({ event: { eventDate: null, endDate: null } }),
    ]);

    await svc.sweep();

    expect(engine.fireAutomations).not.toHaveBeenCalled();
    expect(automations.markEventDelayRuleFired).not.toHaveBeenCalled();
  });
});

describe('EventDelayAutomationsService.sweep — já disparado e rearme', () => {
  it('does nothing when this fire moment was already processed', async () => {
    at('2027-03-10T20:30:00Z');
    const { svc, engine, automations } = make([
      candidate({ firedForAt: new Date('2027-03-10T20:00:00Z') }),
    ]);

    await svc.sweep();

    expect(engine.fireAutomations).not.toHaveBeenCalled();
    expect(automations.markEventDelayRuleFired).not.toHaveBeenCalled();
  });

  it('rearms by itself when the event is rescheduled', async () => {
    at('2027-03-17T20:01:00Z');
    const { svc, engine, automations } = make([
      candidate({
        firedForAt: new Date('2027-03-10T20:00:00Z'),
        event: { eventDate: new Date('2027-03-17T22:00:00Z'), endDate: null },
      }),
    ]);

    await svc.sweep();

    expect(engine.fireAutomations).toHaveBeenCalledWith(
      'reg-1',
      'evt-1',
      'on_event_delay',
      ['rule-1'],
      '2027-03-17T20:00:00.000Z',
    );
    expect(automations.markEventDelayRuleFired).toHaveBeenCalledWith(
      'rule-1',
      new Date('2027-03-17T20:00:00Z'),
    );
  });

  it('fires again when the delay was edited', async () => {
    at('2027-03-10T21:01:00Z');
    const { svc, engine } = make([
      candidate({
        firedForAt: new Date('2027-03-10T20:00:00Z'),
        delay: { direction: 'before', value: 1, unit: 'hours' }, // fireAt = 21:00Z
      }),
    ]);

    await svc.sweep();

    expect(engine.fireAutomations).toHaveBeenCalledTimes(2);
  });
});

describe('EventDelayAutomationsService.sweep — teto de atraso e falhas', () => {
  it('discards (marks without sending) a rule more than 120 min late', async () => {
    at('2027-03-10T22:01:00Z'); // 121 min depois do fireAt
    const { svc, engine, eventRepo, automations } = make([candidate()]);

    await svc.sweep();

    expect(eventRepo.findWithApprovedRegistrationIds).not.toHaveBeenCalled();
    expect(engine.fireAutomations).not.toHaveBeenCalled();
    expect(automations.markEventDelayRuleFired).toHaveBeenCalledWith(
      'rule-1',
      new Date('2027-03-10T20:00:00Z'),
    );
  });

  it('still sends at exactly 120 min late', async () => {
    at('2027-03-10T22:00:00Z');
    const { svc, engine } = make([candidate()]);

    await svc.sweep();

    expect(engine.fireAutomations).toHaveBeenCalledTimes(2);
  });

  it('marks and moves on when the event is not found', async () => {
    at('2027-03-10T20:01:00Z');
    const { svc, eventRepo, engine, automations } = make([
      candidate({ id: 'rule-a' }),
      candidate({ id: 'rule-b' }),
    ]);
    eventRepo.findWithApprovedRegistrationIds.mockResolvedValueOnce(null);

    await svc.sweep();

    expect(automations.markEventDelayRuleFired).toHaveBeenCalledWith('rule-a', expect.any(Date));
    expect(engine.fireAutomations).toHaveBeenCalledWith(
      'reg-1',
      'evt-1',
      'on_event_delay',
      ['rule-b'],
      expect.any(String),
    );
  });

  it('keeps going when the engine rejects for one registration', async () => {
    at('2027-03-10T20:01:00Z');
    const { svc, engine, automations } = make([candidate()]);
    engine.fireAutomations.mockRejectedValueOnce(new Error('boom'));

    await svc.sweep();

    expect(engine.fireAutomations).toHaveBeenCalledTimes(2);
    expect(automations.markEventDelayRuleFired).toHaveBeenCalledTimes(1);
  });

  it('sends only the in-time rule when the first one is stale', async () => {
    at('2027-03-10T22:30:00Z');
    const { svc, engine } = make([
      candidate({ id: 'stale' }), // fireAt 20:00Z, 150 min late
      candidate({ id: 'fresh', delay: { direction: 'before', value: 30, unit: 'minutes' } }), // 21:30Z, 60 min late
    ]);

    await svc.sweep();

    const ruleIds = engine.fireAutomations.mock.calls.map((c) => c[3]);
    expect(ruleIds).toEqual([['fresh'], ['fresh']]);
  });
});

describe('EventDelayAutomationsService.sweep — reentrada', () => {
  it('ignores a tick while another is running, and releases the flag after', async () => {
    at('2027-03-10T20:01:00Z');
    const { svc, automations } = make([]);
    let resolve!: (v: EventDelayCandidate[]) => void;
    automations.findEventDelayCandidates.mockReturnValueOnce(
      new Promise<EventDelayCandidate[]>((r) => (resolve = r)),
    );

    const first = svc.sweep();
    await svc.sweep();
    expect(automations.findEventDelayCandidates).toHaveBeenCalledTimes(1);

    resolve([]);
    await first;
    await svc.sweep();
    expect(automations.findEventDelayCandidates).toHaveBeenCalledTimes(2);
  });

  it('releases the flag even when the sweep throws', async () => {
    at('2027-03-10T20:01:00Z');
    const { svc, automations } = make([]);
    automations.findEventDelayCandidates.mockRejectedValueOnce(new Error('db down'));

    await expect(svc.sweep()).rejects.toThrow('db down');
    await svc.sweep();

    expect(automations.findEventDelayCandidates).toHaveBeenCalledTimes(2);
  });
});
