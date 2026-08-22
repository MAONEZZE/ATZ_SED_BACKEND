import { AutomationEngine } from '@application/automation_module/automation-engine.service';
import { TemplateRenderer } from '@application/shared/template-renderer.service';
import { RegistrationStatusChanged } from '@domain/registration_module/registration-status-changed.event';

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
  whatsappToken: 'tok-evt',
};

function rule(id: string, formIds: string[]) {
  return {
    id,
    templateId: `tpl-${id}`,
    trigger: 'on_registration',
    formIds,
    template: { id: `tpl-${id}`, channel: 'email', subject: 'Bem-vindo', body: 'Oi {{nome}}' },
  };
}

function makeEngine(rules: unknown[]) {
  const automations = {
    findActiveTriggerRules: jest
      .fn()
      .mockImplementation((_eventId: string, _trigger: string, ruleIds?: string[]) =>
        Promise.resolve(
          ruleIds
            ? (rules as { id: string }[]).filter((r) => ruleIds.includes(r.id))
            : rules,
        ),
      ),
  };
  const eventRepo = { findAutomationContext: jest.fn().mockResolvedValue(eventContext) };
  const registrations = { findById: jest.fn().mockResolvedValue(registration) };
  const outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
  const engine = new AutomationEngine(
    automations as any,
    eventRepo as any,
    registrations as any,
    outbox as any,
    new TemplateRenderer(),
  );
  return { engine, outbox };
}

function created(formId: string | null) {
  return new RegistrationStatusChanged('reg-1', 'evt-1', 'pending', 'pending', 'owner-1', formId);
}

// Um evento tem N formulários e qualquer um deles pode criar o inscrito. A regra
// de boas-vindas pode ser do formulário ("quem entrou pela inscrição") ou do
// evento inteiro ("qualquer origem").
describe('AutomationEngine — on_registration escopado por formulário', () => {
  it('fires the rule of the form that created the registration', async () => {
    const { engine, outbox } = makeEngine([rule('rule-a', ['form-a'])]);

    await engine.handleStatusChanged(created('form-a'));

    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    expect(outbox.enqueue.mock.calls[0][0].templateId).toBe('tpl-rule-a');
  });

  it('skips the rule of another form', async () => {
    const { engine, outbox } = makeEngine([rule('rule-a', ['form-a'])]);

    await engine.handleStatusChanged(created('form-b'));

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('fires a rule without form for any origin', async () => {
    const { engine, outbox } = makeEngine([rule('rule-any', [])]);

    await engine.handleStatusChanged(created('form-b'));

    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });

  // Inscrito criado por outro caminho (import, painel) não tem formulário: só as
  // regras abertas valem.
  it('fires only the open rules when there is no form', async () => {
    const { engine, outbox } = makeEngine([rule('rule-a', ['form-a']), rule('rule-any', [])]);

    await engine.handleStatusChanged(created(null));

    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    expect(outbox.enqueue.mock.calls[0][0].templateId).toBe('tpl-rule-any');
  });

  // Com N formulários por regra, o mesmo template em dois formulários é UMA
  // regra com dois formIds — não colide mais no outbox, então formId saiu do
  // dedupKey (revertido de 70040bd).
  it('does not put the form in the dedupKey', async () => {
    const { engine, outbox } = makeEngine([rule('rule-a', ['form-a'])]);

    await engine.handleStatusChanged(created('form-a'));

    expect(outbox.enqueue.mock.calls[0][0].dedupKey).toBe('reg-1:tpl-rule-a:on_registration');
  });
});
