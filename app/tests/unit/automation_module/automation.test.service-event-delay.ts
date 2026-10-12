import { AutomationService } from '@application/automation_module/automation.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AutomationRuleEntity } from '@domain/automation_module/automation-rule.entity';

const EVENT = new Date('2027-03-10T22:00:00Z');
const NOW = new Date('2027-03-08T12:00:00Z');

const DELAY = {
  templateId: 'tpl-1',
  trigger: 'on_event_delay',
  delayDirection: 'before',
  delayValue: 1,
  delayUnit: 'days',
} as const;

function existingDelayRule(over: Partial<{ active: boolean; trigger: string }> = {}) {
  return new AutomationRuleEntity(
    'rule-1',
    'evt-1',
    'tpl-1',
    (over.trigger ?? 'on_event_delay') as never,
    [],
    null,
    null,
    null,
    over.active ?? true,
    null,
    0,
    new Date('2027-01-01T00:00:00Z'),
    null,
    new Date('2027-03-01T00:00:00Z'),
    null,
    null,
    'before',
    1,
    'days',
    new Date('2027-03-09T22:00:00Z'),
  );
}

function existingApprovalRule() {
  return new AutomationRuleEntity(
    'rule-1',
    'evt-1',
    'tpl-1',
    'on_approval',
    [],
    null,
    null,
    null,
    true,
    null,
    0,
    new Date('2027-01-01T00:00:00Z'),
  );
}

function make(
  event: Record<string, unknown> | null = { id: 'evt-1', eventDate: EVENT, endDate: null },
) {
  const repo = {
    templateById: jest.fn().mockResolvedValue({ id: 'tpl-1' }),
    findActiveByEventTriggerAndTemplate: jest.fn().mockResolvedValue(null),
    findByEvent: jest.fn(),
    create: jest
      .fn()
      .mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve({ id: 'rule-1', ...data }),
      ),
    update: jest
      .fn()
      .mockImplementation((id: string, data: Record<string, unknown>) =>
        Promise.resolve({ id, ...data }),
      ),
  };
  const scheduler = { upsert: jest.fn(), remove: jest.fn().mockResolvedValue(undefined) };
  const forms = { findByIdAndEvent: jest.fn().mockResolvedValue({ id: 'form-1' }) };
  const folders = { findById: jest.fn().mockResolvedValue(null) };
  const formFields = { findByFormAndType: jest.fn().mockResolvedValue(null) };
  const events = { findById: jest.fn().mockResolvedValue(event) };
  const svc = new AutomationService(
    repo as any,
    scheduler as any,
    forms as any,
    folders as any,
    formFields as any,
    events as any,
  );
  return { svc, repo, scheduler, events };
}

beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
afterEach(() => jest.useRealTimers());

describe('AutomationService.create — on_event_delay', () => {
  it('persists the delay fields and clears the schedule fields', async () => {
    const { svc, repo, scheduler } = make();

    await svc.create('evt-1', DELAY);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: 'on_event_delay',
        delayDirection: 'before',
        delayValue: 1,
        delayUnit: 'days',
        sendAt: null,
        cron: null,
        timezone: null,
      }),
    );
    expect(scheduler.remove).toHaveBeenCalled();
  });

  it('stores null delay fields for other triggers', async () => {
    const { svc, repo } = make();

    await svc.create('evt-1', {
      templateId: 'tpl-1',
      trigger: 'on_approval',
      delayDirection: 'before',
      delayValue: 1,
      delayUnit: 'days',
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ delayDirection: null, delayValue: null, delayUnit: null }),
    );
  });

  it('rejects an event without eventDate', async () => {
    const { svc } = make({ id: 'evt-1', eventDate: null, endDate: null });
    await expect(svc.create('evt-1', DELAY)).rejects.toThrow(
      new BadRequestException('O evento precisa ter data para usar trigger "on_event_delay"'),
    );
  });

  it('rejects a fire moment already in the past', async () => {
    const { svc } = make({
      id: 'evt-1',
      eventDate: new Date('2027-03-08T20:00:00Z'),
      endDate: null,
    });
    await expect(svc.create('evt-1', DELAY)).rejects.toThrow(
      new BadRequestException(
        'O momento do disparo (data do evento ± delay) precisa ser no futuro',
      ),
    );
  });

  it('rejects a missing delayValue with the validator message', async () => {
    const { svc } = make();
    await expect(svc.create('evt-1', { ...DELAY, delayValue: undefined })).rejects.toThrow(
      'delayValue é obrigatório para trigger "on_event_delay"',
    );
  });

  it('rejects a delay above 365 days', async () => {
    const { svc } = make();
    await expect(svc.create('evt-1', { ...DELAY, delayValue: 366 })).rejects.toThrow(
      'delay máximo é de 365 dias',
    );
  });

  it('"after" counts from endDate, so a past eventDate can still pass', async () => {
    const { svc, repo } = make({
      id: 'evt-1',
      eventDate: new Date('2027-03-01T12:00:00Z'),
      endDate: new Date('2027-03-09T12:00:00Z'),
    });

    await svc.create('evt-1', { ...DELAY, delayDirection: 'after' }); // fireAt 03-10T12:00Z

    expect(repo.create).toHaveBeenCalled();
  });

  it('accepts an inactive rule whose moment already passed', async () => {
    const { svc, repo } = make({
      id: 'evt-1',
      eventDate: new Date('2027-03-08T20:00:00Z'),
      endDate: null,
    });

    await svc.create('evt-1', { ...DELAY, active: false });

    expect(repo.create).toHaveBeenCalled();
  });

  it('404s when the event does not exist', async () => {
    const { svc } = make(null);
    await expect(svc.create('evt-1', DELAY)).rejects.toThrow(
      new NotFoundException('Event not found'),
    );
  });

  it('does not load the event for other triggers', async () => {
    const { svc, events } = make();
    await svc.create('evt-1', { templateId: 'tpl-1', trigger: 'on_approval' });
    expect(events.findById).not.toHaveBeenCalled();
  });
});

describe('AutomationService.create — duplicidade do delay', () => {
  it('checks the duplicate with the delay as key', async () => {
    const { svc, repo } = make();

    await svc.create('evt-1', DELAY);

    expect(repo.findActiveByEventTriggerAndTemplate).toHaveBeenCalledWith(
      'evt-1',
      'on_event_delay',
      'tpl-1',
      undefined,
      undefined,
      { direction: 'before', value: 1, unit: 'days' },
    );
  });

  it('409s with the delay-specific message', async () => {
    const { svc, repo } = make();
    repo.findActiveByEventTriggerAndTemplate.mockResolvedValue({ id: 'other' });

    await expect(svc.create('evt-1', DELAY)).rejects.toThrow(
      new ConflictException(
        'An active automation with this template and delay already exists on this event',
      ),
    );
  });

  it('keeps other triggers without the delay key', async () => {
    const { svc, repo } = make();

    await svc.create('evt-1', { templateId: 'tpl-1', trigger: 'on_approval' });

    expect(repo.findActiveByEventTriggerAndTemplate.mock.calls[0][5]).toBeUndefined();
  });
});

describe('AutomationService.update — on_event_delay', () => {
  it('changing the delay writes it without touching firedForAt (rearm is automatic)', async () => {
    const { svc, repo } = make();
    repo.findByEvent.mockResolvedValue(existingDelayRule());

    await svc.update('evt-1', 'rule-1', { delayValue: 2 }); // fireAt 03-08T22:00Z

    const data = repo.update.mock.calls[0][1];
    expect(data).toMatchObject({ delayValue: 2 });
    expect(data).not.toHaveProperty('firedForAt');
  });

  it('rejects a new delay whose moment is in the past', async () => {
    const { svc, repo } = make({
      id: 'evt-1',
      eventDate: new Date('2027-03-09T10:00:00Z'),
      endDate: null,
    });
    repo.findByEvent.mockResolvedValue(existingDelayRule());

    await expect(svc.update('evt-1', 'rule-1', { delayValue: 2 })).rejects.toThrow(
      'O momento do disparo (data do evento ± delay) precisa ser no futuro',
    );
  });

  it('renaming an already-fired rule whose moment passed is allowed', async () => {
    const { svc, repo, events } = make({
      id: 'evt-1',
      eventDate: new Date('2027-03-08T10:00:00Z'),
      endDate: null,
    });
    repo.findByEvent.mockResolvedValue(existingDelayRule());

    await svc.update('evt-1', 'rule-1', { name: 'x' });

    expect(repo.update).toHaveBeenCalledWith('rule-1', { name: 'x' });
    expect(events.findById).not.toHaveBeenCalled();
  });

  it('reactivating a rule whose moment passed is rejected', async () => {
    const { svc, repo } = make({
      id: 'evt-1',
      eventDate: new Date('2027-03-08T10:00:00Z'),
      endDate: null,
    });
    repo.findByEvent.mockResolvedValue(existingDelayRule({ active: false }));

    await expect(svc.update('evt-1', 'rule-1', { active: true })).rejects.toThrow(
      'O momento do disparo (data do evento ± delay) precisa ser no futuro',
    );
  });

  it('leaving on_event_delay clears the delay fields and firedForAt', async () => {
    const { svc, repo } = make();
    repo.findByEvent.mockResolvedValue(existingDelayRule());

    await svc.update('evt-1', 'rule-1', { trigger: 'on_approval' });

    expect(repo.update).toHaveBeenCalledWith(
      'rule-1',
      expect.objectContaining({
        trigger: 'on_approval',
        delayDirection: null,
        delayValue: null,
        delayUnit: null,
        firedForAt: null,
      }),
    );
  });

  it('switching to on_event_delay validates and writes the delay fields', async () => {
    const { svc, repo } = make();
    repo.findByEvent.mockResolvedValue(existingApprovalRule());

    await svc.update('evt-1', 'rule-1', {
      trigger: 'on_event_delay',
      delayDirection: 'after',
      delayValue: 1,
      delayUnit: 'hours',
    });

    expect(repo.update).toHaveBeenCalledWith(
      'rule-1',
      expect.objectContaining({
        trigger: 'on_event_delay',
        delayDirection: 'after',
        delayValue: 1,
        delayUnit: 'hours',
      }),
    );
  });

  it('switching to on_event_delay without the delay fields is a 400', async () => {
    const { svc, repo } = make();
    repo.findByEvent.mockResolvedValue(existingApprovalRule());

    await expect(svc.update('evt-1', 'rule-1', { trigger: 'on_event_delay' })).rejects.toThrow(
      'delayDirection é obrigatório para trigger "on_event_delay"',
    );
  });

  it('checks the duplicate (with the new delay) only when something relevant changed', async () => {
    const { svc, repo } = make();
    repo.findByEvent.mockResolvedValue(existingDelayRule());

    await svc.update('evt-1', 'rule-1', { name: 'x' });
    expect(repo.findActiveByEventTriggerAndTemplate).not.toHaveBeenCalled();

    await svc.update('evt-1', 'rule-1', { delayValue: 2 });
    expect(repo.findActiveByEventTriggerAndTemplate).toHaveBeenCalledWith(
      'evt-1',
      'on_event_delay',
      'tpl-1',
      'rule-1',
      undefined,
      { direction: 'before', value: 2, unit: 'days' },
    );
  });
});
