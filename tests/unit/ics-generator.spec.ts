import { IcsGeneratorService } from '@services/automations/ics-generator.service';

describe('IcsGeneratorService', () => {
  const ics = new IcsGeneratorService();

  it('emits DTSTART in the given timezone (fixes UTC display bug)', () => {
    // Instante 13:00Z == 10:00 America/Sao_Paulo.
    const out = ics.generate({
      title: 'Reunião',
      start: new Date('2026-07-01T13:00:00.000Z'),
      end: new Date('2026-07-01T14:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
    });
    expect(out).toContain('DTSTART;TZID=America/Sao_Paulo:20260701T100000');
  });

  it('adds an RRULE when repeating is provided', () => {
    const out = ics.generate({
      title: 'Reunião semanal',
      start: new Date('2026-07-01T13:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      repeating: { freq: 'WEEKLY', interval: 1 },
    });
    expect(out).toContain('RRULE:FREQ=WEEKLY');
  });

  it('omits RRULE for a single event', () => {
    const out = ics.generate({
      title: 'Evento único',
      start: new Date('2026-07-01T13:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
    });
    expect(out).not.toContain('RRULE');
  });

  it('uses the stable UID when provided', () => {
    const out = ics.generate({
      title: 'x',
      start: new Date('2026-07-01T13:00:00.000Z'),
      uid: 'invite-ev1-a@b.com',
    });
    expect(out).toContain('UID:invite-ev1-a@b.com');
  });
});
