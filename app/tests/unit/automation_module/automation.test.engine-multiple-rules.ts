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
  status: 'published',
  eventDate: new Date('2026-09-01T18:00:00Z'),
  location: 'SP',
  capacity: 100,
  dressCode: null,
  groupLink: null,
  whatsappToken: 'tok-evt',
};

function rule(id: string, templateId: string, channel: 'email' | 'whatsapp') {
  return {
    id,
    templateId,
    trigger: 'on_approval',
    formIds: [],
    template: {
      id: templateId,
      channel,
      subject: channel === 'email' ? 'Aprovado' : null,
      body: 'Oi {{nome}}',
    },
  };
}

function makeEngine(rules: unknown[]) {
  const automations = { findActiveTriggerRules: jest.fn().mockResolvedValue(rules) };
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
  return { engine, outbox, automations };
}

// O caso de uso: uma automação de e-mail e uma de WhatsApp no mesmo gatilho
// on_approval. O engine já itera todas as regras ativas; o que impedia era a
// validação de duplicata no service (removida) — e o dedupKey só não colide
// porque carrega o templateId.
describe('AutomationEngine — múltiplas regras no mesmo gatilho', () => {
  it('enqueues one message per rule, one per channel', async () => {
    const { engine, outbox } = makeEngine([
      rule('rule-email', 'tpl-email', 'email'),
      rule('rule-whats', 'tpl-whats', 'whatsapp'),
    ]);

    await engine.fireAutomations('reg-1', 'evt-1', 'on_approval');

    expect(outbox.enqueue).toHaveBeenCalledTimes(2);
    const channels = outbox.enqueue.mock.calls.map(([data]) => data.channel);
    expect(channels).toEqual(['email', 'whatsapp']);
  });

  it('routes each message to the address of its own channel', async () => {
    const { engine, outbox } = makeEngine([
      rule('rule-email', 'tpl-email', 'email'),
      rule('rule-whats', 'tpl-whats', 'whatsapp'),
    ]);

    await engine.fireAutomations('reg-1', 'evt-1', 'on_approval');

    const [emailCall, whatsCall] = outbox.enqueue.mock.calls.map(([data]) => data);
    expect(emailCall.recipient).toBe('joao@test.com');
    expect(whatsCall.recipient).toBe('+5511999998888');
  });

  // O dedupKey é `registrationId:templateId:trigger` (+ formulário, quando a
  // regra tem um) — templates distintos, chaves distintas.
  it('builds one dedupKey per rule from registration, template and trigger', async () => {
    const { engine, outbox } = makeEngine([
      rule('rule-email', 'tpl-email', 'email'),
      rule('rule-whats', 'tpl-whats', 'whatsapp'),
    ]);

    await engine.fireAutomations('reg-1', 'evt-1', 'on_approval');

    const templateIds = outbox.enqueue.mock.calls.map(([data]) => data.templateId);
    expect(templateIds).toEqual(['tpl-email', 'tpl-whats']);
    const dedupKeys = outbox.enqueue.mock.calls.map(([data]) => data.dedupKey);
    expect(dedupKeys).toEqual(['reg-1:tpl-email:on_approval', 'reg-1:tpl-whats:on_approval']);
  });

  // Contato sem Registration (resposta de formulário de quem não é inscrito): o
  // engine monta a chave, e ela também separa as duas regras pelo templateId.
  it('builds distinct dedupKeys per rule for a contact without registration', async () => {
    const { engine, outbox } = makeEngine([
      rule('rule-email', 'tpl-email', 'email'),
      rule('rule-whats', 'tpl-whats', 'whatsapp'),
    ]);

    await engine.fireForForm('evt-1', 'form-1', {
      name: 'João',
      email: 'joao@test.com',
      phone: '+5511999998888',
    });

    const keys = outbox.enqueue.mock.calls.map(([data]) => data.dedupKey);
    expect(new Set(keys).size).toBe(2);
    expect(keys[0]).toContain('tpl-email');
    expect(keys[1]).toContain('tpl-whats');
  });
});

// on_form_submitted: as regras do evento são filtradas pelo formulário respondido.
describe('AutomationEngine — gatilho por formulário', () => {
  function formRule(id: string, templateId: string, formId: string) {
    return {
      id,
      templateId,
      formIds: [formId],
      trigger: 'on_form_submitted',
      template: { id: templateId, channel: 'email', subject: 'Obrigado', body: 'Oi {{nome}}' },
    };
  }

  it('fires only the rules bound to the submitted form', async () => {
    const { engine, outbox, automations } = makeEngine([
      formRule('rule-nps', 'tpl-nps', 'form-nps'),
      formRule('rule-pos', 'tpl-pos', 'form-pos'),
    ]);

    await engine.fireForForm('evt-1', 'form-nps', {
      name: 'João',
      email: 'joao@test.com',
      phone: '+5511999998888',
    });

    // A segunda chamada (dentro do dispatch) recebe os ruleIds já filtrados.
    expect(automations.findActiveTriggerRules).toHaveBeenLastCalledWith(
      'evt-1',
      'on_form_submitted',
      ['rule-nps'],
    );
    expect(outbox.enqueue).toHaveBeenCalled();
  });

  it('does nothing when no rule is bound to that form', async () => {
    const { engine, outbox } = makeEngine([formRule('rule-pos', 'tpl-pos', 'form-pos')]);

    await engine.fireForForm('evt-1', 'form-nps', {
      name: 'João',
      email: 'joao@test.com',
      phone: '+5511999998888',
    });

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
});
