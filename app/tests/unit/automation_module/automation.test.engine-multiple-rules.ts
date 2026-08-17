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
  whatsappToken: 'tok-evt',
};

function rule(id: string, templateId: string, channel: 'email' | 'whatsapp') {
  return {
    id,
    templateId,
    trigger: 'on_approval',
    template: { id: templateId, channel, subject: channel === 'email' ? 'Aprovado' : null, body: 'Oi {{nome}}' },
  };
}

function makeEngine(rules: unknown[]) {
  const automations = { findActiveTriggerRules: jest.fn().mockResolvedValue(rules) };
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

  // Com registrationId o dedupKey é montado no OutboxService como
  // `registrationId:templateId:trigger` — templates distintos, chaves distintas.
  it('leaves the dedupKey to the outbox and keeps the templateId distinct per rule', async () => {
    const { engine, outbox } = makeEngine([
      rule('rule-email', 'tpl-email', 'email'),
      rule('rule-whats', 'tpl-whats', 'whatsapp'),
    ]);

    await engine.fireAutomations('reg-1', 'evt-1', 'on_approval');

    const templateIds = outbox.enqueue.mock.calls.map(([data]) => data.templateId);
    expect(templateIds).toEqual(['tpl-email', 'tpl-whats']);
    expect(outbox.enqueue.mock.calls.every(([data]) => data.dedupKey === undefined)).toBe(true);
  });

  // Sem Registration (pós-evento/NPS) o engine monta a chave, e ela também
  // separa as duas regras pelo templateId.
  it('builds distinct dedupKeys per rule for a contact without registration', async () => {
    const { engine, outbox } = makeEngine([
      rule('rule-email', 'tpl-email', 'email'),
      rule('rule-whats', 'tpl-whats', 'whatsapp'),
    ]);

    await engine.fireForContact('evt-1', 'on_approval', {
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
