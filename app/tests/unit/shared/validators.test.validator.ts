import { EventValidator } from '@domain/event_module/event.validator';
import { EventEntity } from '@domain/event_module/event.entity';
import { AutomationValidator } from '@domain/automation_module/automation.validator';
import { MessageTemplateValidator } from '@domain/message_template_module/message-template.validator';
import { FormFieldValidator } from '@domain/form_field_module/form-field.validator';

describe('EventValidator', () => {
  const validator = new EventValidator();

  it('accepts an event with no dates at all', () => {
    expect(validator.validate({})).toEqual([]);
  });

  it('accepts an end after the start', () => {
    expect(
      validator.validate({
        eventDate: new Date('2026-09-01T10:00:00Z'),
        endDate: new Date('2026-09-01T12:00:00Z'),
      }),
    ).toEqual([]);
  });

  it('rejects an end before the start', () => {
    expect(
      validator.validate({
        eventDate: new Date('2026-09-01T12:00:00Z'),
        endDate: new Date('2026-09-01T10:00:00Z'),
      }),
    ).toEqual(['endDate must be after eventDate']);
  });

  // Same instant means zero duration, which is not a period.
  it('rejects an end equal to the start', () => {
    const at = new Date('2026-09-01T10:00:00Z');
    expect(validator.validate({ eventDate: at, endDate: at })).toEqual([
      'endDate must be after eventDate',
    ]);
  });

  // A start with no end is an open-ended event, which is allowed.
  it('accepts a start with no end', () => {
    expect(validator.validate({ eventDate: new Date('2026-09-01T10:00:00Z') })).toEqual([]);
  });

  describe('validateTransition', () => {
    const draft = new EventEntity('evt-1', 'owner-1', 'Festa', 'festa', 'draft');
    const cancelled = new EventEntity('evt-2', 'owner-1', 'Festa', 'festa', 'cancelled');

    it('allows a legal transition', () => {
      expect(EventValidator.validateTransition(draft, 'published')).toEqual([]);
    });

    it('rejects a transition out of a terminal status', () => {
      expect(EventValidator.validateTransition(cancelled, 'published')).toEqual([
        "Cannot transition from 'cancelled' to 'published'",
      ]);
    });
  });
});

describe('AutomationValidator', () => {
  const validator = new AutomationValidator();

  it('ignores cron and timezone for an event-driven trigger', () => {
    expect(validator.validate({ trigger: 'on_registration' })).toEqual([]);
  });

  it('accepts a recurring rule with a full schedule', () => {
    expect(
      validator.validate({
        trigger: 'recurring',
        cron: '0 9 * * 1',
        timezone: 'America/Sao_Paulo',
      }),
    ).toEqual([]);
  });

  it('reports both problems when a recurring rule has no schedule at all', () => {
    expect(validator.validate({ trigger: 'recurring' })).toEqual([
      'cron é obrigatório para trigger "recurring"',
      'timezone é obrigatório para trigger "recurring"',
    ]);
  });

  it('rejects a recurring rule missing only the timezone', () => {
    expect(validator.validate({ trigger: 'recurring', cron: '0 9 * * 1' })).toEqual([
      'timezone é obrigatório para trigger "recurring"',
    ]);
  });
});

describe('MessageTemplateValidator', () => {
  const validator = new MessageTemplateValidator();

  it('accepts a whatsapp template without a subject', () => {
    expect(validator.validate({ channel: 'whatsapp' })).toEqual([]);
  });

  it('accepts an email template with a subject', () => {
    expect(validator.validate({ channel: 'email', subject: 'Olá' })).toEqual([]);
  });

  it('rejects an email template without a subject', () => {
    expect(validator.validate({ channel: 'email' })).toEqual([
      'subject é obrigatório para templates de email',
    ]);
  });

  // A subject of spaces would send an e-mail with an empty subject line.
  it('rejects a whitespace-only subject', () => {
    expect(validator.validate({ channel: 'email', subject: '   ' })).toEqual([
      'subject é obrigatório para templates de email',
    ]);
  });
});

describe('FormFieldValidator', () => {
  const validator = new FormFieldValidator();

  it('accepts a text field with no options', () => {
    expect(validator.validate({ type: 'text' })).toEqual([]);
  });

  it('accepts a select with options', () => {
    expect(validator.validate({ type: 'select', options: ['a', 'b'] })).toEqual([]);
  });

  it('rejects a select with no options', () => {
    expect(validator.validate({ type: 'select' })).toEqual([
      'Campo do tipo "select" exige uma lista de opções',
    ]);
  });

  // An empty array is as unanswerable as no array.
  it('rejects a multiselect with an empty options array', () => {
    expect(validator.validate({ type: 'multiselect', options: [] })).toEqual([
      'Campo do tipo "multiselect" exige uma lista de opções',
    ]);
  });
});

describe('ValidatorBase.isValid', () => {
  it('mirrors an empty error list', () => {
    expect(new AutomationValidator().isValid({ trigger: 'on_approval' })).toBe(true);
    expect(new AutomationValidator().isValid({ trigger: 'recurring' })).toBe(false);
  });
});
