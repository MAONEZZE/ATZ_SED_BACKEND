import { DateTime } from 'luxon';
import { clampMatches } from '@application/automation_module/form-field-date-automations.service';

describe('clampMatches', () => {
  it('dia 31 dispara em fevereiro (clamp pro último dia do mês)', () => {
    const anchor = DateTime.fromISO('2027-02-28T09:00:00Z'); // último dia de fev/2027 (não bissexto)
    expect(clampMatches(31, anchor)).toBe(true);
  });

  it('dia 31 dispara em abril (30 dias)', () => {
    const anchor = DateTime.fromISO('2027-04-30T09:00:00Z');
    expect(clampMatches(31, anchor)).toBe(true);
  });

  it('dia 31 dispara em maio normalmente (31 dias, sem clamp)', () => {
    const anchor = DateTime.fromISO('2027-05-31T09:00:00Z');
    expect(clampMatches(31, anchor)).toBe(true);
  });

  it('dia 31 NÃO dispara no dia 30 de um mês de 31 dias (> e não >=)', () => {
    const anchor = DateTime.fromISO('2027-05-30T09:00:00Z');
    expect(clampMatches(31, anchor)).toBe(false);
  });

  it('dia 29 dispara em fevereiro bissexto no próprio dia 29 (sem clamp)', () => {
    const anchor = DateTime.fromISO('2028-02-29T09:00:00Z'); // 2028 é bissexto
    expect(clampMatches(29, anchor)).toBe(true);
  });

  it('dia 29 dispara em fevereiro não-bissexto (clamp pro dia 28)', () => {
    const anchor = DateTime.fromISO('2027-02-28T09:00:00Z'); // 2027 não é bissexto
    expect(clampMatches(29, anchor)).toBe(true);
  });

  // No tick do último dia do mês (29 em bissexto), TODOS os dias além do fim
  // do mês caem no clamp — 30 e 31 disparam junto de 29, mesmo tick.
  it('dia 30 dispara no tick do dia 29 em fevereiro bissexto (clamp, mesmo lote)', () => {
    const anchor = DateTime.fromISO('2028-02-29T09:00:00Z');
    expect(clampMatches(30, anchor)).toBe(true);
  });

  it('dia normal (15) só dispara no próprio dia', () => {
    const anchor15 = DateTime.fromISO('2027-06-15T09:00:00Z');
    const anchor16 = DateTime.fromISO('2027-06-16T09:00:00Z');
    expect(clampMatches(15, anchor15)).toBe(true);
    expect(clampMatches(15, anchor16)).toBe(false);
  });
});
