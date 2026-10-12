import {
  AUTOMATION_TRIGGERS,
  AutomationRuleEntity,
  delayToMinutes,
} from '@domain/automation_module/automation-rule.entity';

const EVENT = new Date('2027-03-10T22:00:00Z');
const END = new Date('2027-03-11T02:00:00Z');

function baseRule(extra: unknown[] = []) {
  return new AutomationRuleEntity(
    'r1',
    'evt-1',
    'tpl-1',
    'on_event_delay',
    [],
    null,
    null,
    null,
    true,
    null,
    0,
    new Date('2027-01-01T00:00:00Z'),
    null,
    null,
    null,
    null,
    ...(extra as [never, never, never, never]),
  );
}

describe('on_event_delay trigger', () => {
  it('is an accepted trigger', () => expect(AUTOMATION_TRIGGERS).toContain('on_event_delay'));

  it('isEventDelay only for on_event_delay', () => {
    expect(AutomationRuleEntity.isEventDelay('on_event_delay')).toBe(true);
    expect(AutomationRuleEntity.isEventDelay('on_date')).toBe(false);
  });

  it('is scoped by form response, like on_date', () =>
    expect(AutomationRuleEntity.scopedByResponse('on_event_delay')).toBe(true));

  it('does not require a form', () =>
    expect(AutomationRuleEntity.requiresForm('on_event_delay')).toBe(false));
});

describe('AutomationRuleEntity delay fields', () => {
  it('defaults the delay fields and firedForAt to null', () => {
    const rule = baseRule();
    expect(rule.delayDirection).toBeNull();
    expect(rule.delayValue).toBeNull();
    expect(rule.delayUnit).toBeNull();
    expect(rule.firedForAt).toBeNull();
  });

  it('exposes the delay fields when given', () => {
    const fired = new Date('2027-03-10T20:00:00Z');
    const rule = baseRule(['before', 2, 'hours', fired]);
    expect(rule.delayDirection).toBe('before');
    expect(rule.delayValue).toBe(2);
    expect(rule.delayUnit).toBe('hours');
    expect(rule.firedForAt).toEqual(fired);
  });
});

describe('delayToMinutes', () => {
  it.each([
    [30, 'minutes', 30],
    [2, 'hours', 120],
    [3, 'days', 4320],
    [365, 'days', 525600],
  ] as const)('%d %s = %d minutes', (value, unit, expected) => {
    expect(delayToMinutes(value, unit)).toBe(expected);
  });
});

describe('eventDelayReference', () => {
  it('before uses eventDate even when endDate exists', () =>
    expect(
      AutomationRuleEntity.eventDelayReference({ eventDate: EVENT, endDate: END }, 'before'),
    ).toEqual(EVENT));

  it('after uses endDate when present', () =>
    expect(
      AutomationRuleEntity.eventDelayReference({ eventDate: EVENT, endDate: END }, 'after'),
    ).toEqual(END));

  it('after falls back to eventDate without endDate', () =>
    expect(
      AutomationRuleEntity.eventDelayReference({ eventDate: EVENT, endDate: null }, 'after'),
    ).toEqual(EVENT));

  it.each(['before', 'after'] as const)('is null without eventDate (%s)', (direction) =>
    expect(
      AutomationRuleEntity.eventDelayReference({ eventDate: null, endDate: END }, direction),
    ).toBeNull(),
  );
});

describe('computeEventDelayFireAt', () => {
  it('before 2 hours', () =>
    expect(
      AutomationRuleEntity.computeEventDelayFireAt(
        { eventDate: EVENT, endDate: null },
        { direction: 'before', value: 2, unit: 'hours' },
      ),
    ).toEqual(new Date('2027-03-10T20:00:00Z')));

  it('after 1 days counts from endDate', () =>
    expect(
      AutomationRuleEntity.computeEventDelayFireAt(
        { eventDate: EVENT, endDate: END },
        { direction: 'after', value: 1, unit: 'days' },
      ),
    ).toEqual(new Date('2027-03-12T02:00:00Z')));

  it('before 30 minutes', () =>
    expect(
      AutomationRuleEntity.computeEventDelayFireAt(
        { eventDate: EVENT, endDate: null },
        { direction: 'before', value: 30, unit: 'minutes' },
      ),
    ).toEqual(new Date('2027-03-10T21:30:00Z')));

  it('is null without eventDate', () =>
    expect(
      AutomationRuleEntity.computeEventDelayFireAt(
        { eventDate: null, endDate: null },
        { direction: 'before', value: 1, unit: 'hours' },
      ),
    ).toBeNull());
});
