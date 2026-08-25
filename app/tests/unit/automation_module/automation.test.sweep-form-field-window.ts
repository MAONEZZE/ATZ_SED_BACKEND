import { DateTime } from 'luxon';
import {
  resolveWindow,
  FormFieldDateAutomationsService,
} from '@application/automation_module/form-field-date-automations.service';

describe('resolveWindow', () => {
  it('matches exactly at the anchor', () => {
    const now = DateTime.fromISO('2027-02-12T09:00:00', { zone: 'UTC' });
    const result = resolveWindow(now, 'UTC', '09:00');
    expect(result).not.toBeNull();
    expect(result!.anchor.toISO()).toBe(now.toISO());
    expect(result!.occurrenceKey).toBe('2027-02');
  });

  it('matches at the edge of tolerance (29min after anchor)', () => {
    const now = DateTime.fromISO('2027-02-12T09:29:00', { zone: 'UTC' });
    expect(resolveWindow(now, 'UTC', '09:00')).not.toBeNull();
  });

  it('does not match past tolerance (31min after anchor)', () => {
    const now = DateTime.fromISO('2027-02-12T09:31:00', { zone: 'UTC' });
    expect(resolveWindow(now, 'UTC', '09:00')).toBeNull();
  });

  it('does not match before the anchor', () => {
    const now = DateTime.fromISO('2027-02-12T08:59:00', { zone: 'UTC' });
    expect(resolveWindow(now, 'UTC', '09:00')).toBeNull();
  });

  // O teste que impede o envio duplo 31/jan -> 01/fev: os dois ticks da
  // virada compartilham a chave (do âncora), não a data corrente.
  it('window crossing midnight keeps the occurrenceKey of the anchor day, not of `now`', () => {
    const now = DateTime.fromISO('2027-02-01T00:05:00', { zone: 'UTC' });
    const result = resolveWindow(now, 'UTC', '23:50');
    expect(result).not.toBeNull();
    expect(result!.anchor.toISODate()).toBe('2027-01-31');
    expect(result!.occurrenceKey).toBe('2027-01');
  });

  it('off:0 and off:-1 never match together (24h apart)', () => {
    // sendTime 23:50, tolerância 30min: 00:05 só pode casar com ontem (off:-1).
    const now = DateTime.fromISO('2027-02-01T00:05:00', { zone: 'UTC' });
    const result = resolveWindow(now, 'UTC', '23:50');
    expect(result!.anchor.toISODate()).toBe('2027-01-31');
  });

  it('returns null for an invalid sendTime (permanently dead rule)', () => {
    const now = DateTime.fromISO('2027-02-12T09:00:00', { zone: 'UTC' });
    expect(resolveWindow(now, 'UTC', '25:99')).toBeNull();
    expect(resolveWindow(now, 'UTC', '9:00')).toBeNull();
  });

  // DST não pode derrubar o cálculo — Europe/Lisbon adianta o relógio no
  // último domingo de março.
  it('survives a DST transition in Europe/Lisbon', () => {
    const now = DateTime.fromISO('2027-03-28T09:00:00', { zone: 'Europe/Lisbon' });
    const result = resolveWindow(now, 'Europe/Lisbon', '09:00');
    expect(result).not.toBeNull();
    expect(result!.occurrenceKey).toBe('2027-03');
  });
});

describe('FormFieldDateAutomationsService.sweep — pré-filtro de janela', () => {
  function makeService(rules: unknown[]) {
    const automations = {
      findActiveFormFieldDateRules: jest.fn().mockResolvedValue(rules),
    };
    const formFields = { findByFormAndType: jest.fn() };
    const formResponses = { findApprovedByForm: jest.fn() };
    const engine = { fireAutomations: jest.fn() };
    const svc = new FormFieldDateAutomationsService(
      automations as any,
      formFields as any,
      formResponses as any,
      engine as any,
    );
    return { svc, formFields };
  }

  it('custo de 1 SELECT quando nenhuma regra cai na janela: findByFormAndType nunca é chamado', async () => {
    // Relógio travado ao meio-dia UTC; regra em UTC 00:00 fica bem fora da
    // janela de 30min tanto pro âncora de hoje quanto pro de ontem.
    const nowSpy = jest
      .spyOn(DateTime, 'now')
      .mockReturnValue(DateTime.fromISO('2027-06-15T12:00:00Z') as any);
    try {
      const { svc, formFields } = makeService([
        { id: 'rule-1', eventId: 'evt-1', sendTime: '00:00', timezone: 'UTC', formIds: ['form-1'] },
      ]);

      await svc.sweep();

      expect(formFields.findByFormAndType).not.toHaveBeenCalled();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('não faz nada quando não há regras ativas', async () => {
    const { svc, formFields } = makeService([]);
    await svc.sweep();
    expect(formFields.findByFormAndType).not.toHaveBeenCalled();
  });

  it('regra legada sem formIds nunca chega no cálculo de janela', async () => {
    const { svc, formFields } = makeService([
      { id: 'rule-legacy', eventId: 'evt-1', sendTime: '09:00', timezone: 'UTC', formIds: [] },
    ]);

    await expect(svc.sweep()).resolves.not.toThrow();

    expect(formFields.findByFormAndType).not.toHaveBeenCalled();
  });
});
