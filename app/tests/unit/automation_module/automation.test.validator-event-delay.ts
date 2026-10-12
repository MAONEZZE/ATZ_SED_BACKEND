import { AutomationValidator } from '@domain/automation_module/automation.validator';

const validate = (over: Record<string, unknown> = {}) =>
  new AutomationValidator().validate({
    trigger: 'on_event_delay',
    delayDirection: 'before',
    delayValue: 2,
    delayUnit: 'hours',
    ...over,
  } as never);

describe('AutomationValidator on_event_delay', () => {
  it('accepts a complete delay', () => expect(validate()).toEqual([]));

  it.each([
    ['delayDirection', { delayDirection: undefined }],
    ['delayValue', { delayValue: undefined }],
    ['delayUnit', { delayUnit: undefined }],
  ])('requires %s', (field, over) => {
    expect(validate(over)).toContain(`${field} é obrigatório para trigger "on_event_delay"`);
  });

  it('ignores delay fields for other triggers', () => {
    expect(new AutomationValidator().validate({ trigger: 'on_approval' } as never)).toEqual([]);
  });

  it.each([0, 1.5, -1])('rejects delayValue %p', (delayValue) => {
    expect(validate({ delayValue })).toContain('delayValue deve ser um inteiro ≥ 1');
  });

  it('rejects an unknown direction', () =>
    expect(validate({ delayDirection: 'during' })).toContain(
      'delayDirection deve ser "before" ou "after"',
    ));

  it('rejects an unknown unit', () =>
    expect(validate({ delayUnit: 'weeks' })).toContain(
      'delayUnit deve ser "minutes", "hours" ou "days"',
    ));

  it.each([
    [366, 'days'],
    [8761, 'hours'],
    [525601, 'minutes'],
  ])('rejects %d %s over the 365-day ceiling', (delayValue, delayUnit) => {
    expect(validate({ delayValue, delayUnit })).toContain('delay máximo é de 365 dias');
  });

  it.each([
    [365, 'days'],
    [525600, 'minutes'],
  ])('accepts %d %s (the ceiling)', (delayValue, delayUnit) => {
    expect(validate({ delayValue, delayUnit })).toEqual([]);
  });

  it('does not report the ceiling when the value itself is invalid', () => {
    expect(validate({ delayValue: 0, delayUnit: 'days' })).not.toContain(
      'delay máximo é de 365 dias',
    );
  });
});
