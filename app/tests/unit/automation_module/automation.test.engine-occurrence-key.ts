import { AutomationEngine } from '@application/automation_module/automation-engine.service';
import { TemplateRenderer } from '@application/shared/template-renderer.service';

const registration = {
  id: 'reg-1',
  name: 'João',
  email: 'joao@test.com',
  phone: '+5511999998888',
};

const eventContext = {
  id: 'evt-1',
  ownerId: 'owner-1',
  title: 'Tech Day',
  eventDate: new Date('2026-09-01T18:00:00Z'),
  location: 'SP',
  capacity: 100,
  dressCode: null,
  groupLink: null,
  whatsappToken: null,
};

function recurringRule() {
  return {
    id: 'rule-recurring',
    templateId: 'tpl-recurring',
    trigger: 'recurring',
    template: { id: 'tpl-recurring', channel: 'whatsapp', subject: null, body: 'Oi {{nome}}' },
  };
}

function makeEngine() {
  const automations = { findActiveTriggerRules: jest.fn().mockResolvedValue([recurringRule()]) };
  const eventRepo = { findAutomationContext: jest.fn().mockResolvedValue(eventContext) };
  const registrations = { findById: jest.fn().mockResolvedValue(registration) };
  const formResponses = { findFormIdsByRegistration: jest.fn().mockResolvedValue([]) };
  const outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
  const engine = new AutomationEngine(
    automations as any,
    eventRepo as any,
    registrations as any,
    formResponses as any,
    outbox as any,
    new TemplateRenderer(),
  );
  return { engine, outbox };
}

// job.timestamp (fixado na criação do job pelo BullMQ) vira occurrenceKey:
// ocorrência nova = chave nova; retry da mesma ocorrência = mesma chave.
describe('AutomationEngine — occurrenceKey no dedupKey da recorrência', () => {
  it('builds distinct dedupKeys for two different occurrences', async () => {
    const { engine, outbox } = makeEngine();

    await engine.fireAutomations('reg-1', 'evt-1', 'recurring', ['rule-recurring'], '1000');
    await engine.fireAutomations('reg-1', 'evt-1', 'recurring', ['rule-recurring'], '2000');

    const dedupKeys = outbox.enqueue.mock.calls.map(([data]) => data.dedupKey);
    expect(dedupKeys[0]).not.toEqual(dedupKeys[1]);
    expect(dedupKeys[0]).toContain(':1000');
    expect(dedupKeys[1]).toContain(':2000');
  });

  it('builds the same dedupKey when the same occurrence is retried', async () => {
    const { engine, outbox } = makeEngine();

    await engine.fireAutomations('reg-1', 'evt-1', 'recurring', ['rule-recurring'], '1000');
    await engine.fireAutomations('reg-1', 'evt-1', 'recurring', ['rule-recurring'], '1000');

    const dedupKeys = outbox.enqueue.mock.calls.map(([data]) => data.dedupKey);
    expect(dedupKeys[0]).toEqual(dedupKeys[1]);
  });

  it('leaves the dedupKey unchanged for reactive triggers (no occurrenceKey)', async () => {
    const { engine, outbox } = makeEngine();

    await engine.fireAutomations('reg-1', 'evt-1', 'recurring', ['rule-recurring']);

    const [data] = outbox.enqueue.mock.calls[0];
    expect(data.dedupKey).toBe('reg-1:tpl-recurring:recurring');
  });

  it('builds reg-1:<tpl>:on_date_form_field:2026-10 for the monthly trigger', async () => {
    const { engine, outbox } = makeEngine();

    await engine.fireAutomations(
      'reg-1',
      'evt-1',
      'on_date_form_field',
      ['rule-recurring'],
      '2026-10',
    );

    const [data] = outbox.enqueue.mock.calls[0];
    expect(data.dedupKey).toBe('reg-1:tpl-recurring:on_date_form_field:2026-10');
  });

  // Regra escopada em 2 formulários dispara 2 ocorrências no mesmo mês — o
  // formId no occurrenceKey (montado pelo sweeper) é o que separa as duas.
  it('builds distinct dedupKeys for the same month when the occurrenceKey carries different formIds', async () => {
    const { engine, outbox } = makeEngine();

    await engine.fireAutomations(
      'reg-1',
      'evt-1',
      'on_date_form_field',
      ['rule-recurring'],
      '2026-10:form-a',
    );
    await engine.fireAutomations(
      'reg-1',
      'evt-1',
      'on_date_form_field',
      ['rule-recurring'],
      '2026-10:form-b',
    );

    const dedupKeys = outbox.enqueue.mock.calls.map(([data]) => data.dedupKey);
    expect(dedupKeys[0]).toBe('reg-1:tpl-recurring:on_date_form_field:2026-10:form-a');
    expect(dedupKeys[1]).toBe('reg-1:tpl-recurring:on_date_form_field:2026-10:form-b');
  });

  it('repasses extra vars (dia_automacao) pro renderer', async () => {
    const { engine, outbox } = makeEngine();
    const monthlyRule = {
      id: 'rule-monthly',
      templateId: 'tpl-monthly',
      trigger: 'on_date_form_field',
      template: {
        id: 'tpl-monthly',
        channel: 'whatsapp',
        subject: null,
        body: 'Dia {{dia_automacao}}',
      },
    };
    (
      engine as unknown as { automations: { findActiveTriggerRules: jest.Mock } }
    ).automations.findActiveTriggerRules = jest.fn().mockResolvedValue([monthlyRule]);

    await engine.fireAutomations(
      'reg-1',
      'evt-1',
      'on_date_form_field',
      ['rule-monthly'],
      '2026-10',
      { dia_automacao: '31' },
    );

    const [data] = outbox.enqueue.mock.calls[0];
    expect(data.renderedBody).toBe('Dia 31');
  });
});
