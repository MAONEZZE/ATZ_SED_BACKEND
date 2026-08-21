import { DateTime } from 'luxon';
import {
  parseDay,
  FormFieldDateAutomationsService,
} from '@application/automation_module/form-field-date-automations.service';

describe('parseDay', () => {
  it('parses AAAA-MM-DD', () => {
    expect(parseDay('2026-10-20')).toBe(20);
  });

  it('parses dd/MM/yyyy (legado de campo que era date)', () => {
    expect(parseDay('20/10/2026')).toBe(20);
  });

  it('never MM/DD/YYYY (ambíguo) — só aceita o formato BR', () => {
    // "13/01/2026" só faz sentido como dd/MM (mês 13 não existe em MM/DD)
    expect(parseDay('13/01/2026')).toBe(13);
  });

  it.each(['2026', '2026-13-01', '2026-02-30', 'não é data', ''])(
    'returns null for unparseable value %s',
    (value) => {
      expect(parseDay(value)).toBeNull();
    },
  );

  it('returns null for a number', () => {
    expect(parseDay(20)).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(parseDay(null)).toBeNull();
    expect(parseDay(undefined)).toBeNull();
  });
});

describe('FormFieldDateAutomationsService.sweep — comportamento do lote', () => {
  const FIXED_NOW = DateTime.fromISO('2027-06-15T09:00:00Z');

  function makeService(responsesPage: Array<{ registrationId: string; answers: Record<string, unknown> }>) {
    const rules = [
      { id: 'rule-A', eventId: 'evt-1', sendTime: '09:00', timezone: 'UTC' },
      { id: 'rule-B', eventId: 'evt-1', sendTime: '09:00', timezone: 'UTC' },
    ];
    const automations = { findActiveFormFieldDateRules: jest.fn().mockResolvedValue(rules) };
    const formFields = {
      findByEventAndType: jest
        .fn()
        .mockResolvedValue({ id: 'field-1', formId: 'form-1', label: 'Dia' }),
    };
    const formResponses = {
      findApprovedByForm: jest.fn().mockResolvedValue(responsesPage),
    };
    const engine = { fireAutomations: jest.fn().mockResolvedValue(undefined) };
    const svc = new FormFieldDateAutomationsService(
      automations as any,
      formFields as any,
      formResponses as any,
      engine as any,
    );
    return { svc, formFields, formResponses, engine };
  }

  let nowSpy: jest.SpyInstance;
  beforeEach(() => {
    nowSpy = jest.spyOn(DateTime, 'now').mockReturnValue(FIXED_NOW as any);
  });
  afterEach(() => nowSpy.mockRestore());

  it('valores não-parseáveis e vazios nunca lançam — só contam, e o disparo segue pros outros', async () => {
    const { svc, engine } = makeService([
      { registrationId: 'reg-1', answers: { 'field-1': '2026' } }, // unparseable
      { registrationId: 'reg-2', answers: { 'field-1': '09/01/2026' } }, // legado, dia 9 != 15
      { registrationId: 'reg-3', answers: { 'field-1': '' } }, // vazio
      { registrationId: 'reg-4', answers: { 'field-1': 20260615 } }, // número, unparseable
      { registrationId: 'reg-5', answers: { 'field-1': '2027-06-15' } }, // dia certo, dispara
    ]);

    await expect(svc.sweep()).resolves.not.toThrow();

    expect(engine.fireAutomations).toHaveBeenCalledWith(
      'reg-5',
      'evt-1',
      'on_date_form_field',
      expect.arrayContaining([expect.stringMatching(/^rule-/)]),
      '2027-06',
      { dia_automacao: '15' },
    );
  });

  it('um fireAutomations que rejeita não aborta o lote — os outros inscritos ainda disparam', async () => {
    const { svc, engine } = makeService([
      { registrationId: 'reg-fail', answers: { 'field-1': '2027-06-15' } },
      { registrationId: 'reg-ok', answers: { 'field-1': '2027-06-15' } },
    ]);
    engine.fireAutomations.mockImplementation((registrationId: string) =>
      registrationId === 'reg-fail'
        ? Promise.reject(new Error('boom'))
        : Promise.resolve(undefined),
    );

    await expect(svc.sweep()).resolves.not.toThrow();

    const okCalls = engine.fireAutomations.mock.calls.filter(([rid]) => rid === 'reg-ok');
    expect(okCalls.length).toBeGreaterThan(0);
  });

  it('duas regras do mesmo evento buscam campo e respostas uma única vez', async () => {
    const { svc, formFields, formResponses } = makeService([
      { registrationId: 'reg-1', answers: { 'field-1': '2027-06-15' } },
    ]);

    await svc.sweep();

    expect(formFields.findByEventAndType).toHaveBeenCalledTimes(1);
    expect(formResponses.findApprovedByForm).toHaveBeenCalledTimes(1);
  });
});
