import { AutomationEngine } from '@application/automation_module/automation-engine.service';
import { TemplateRenderer } from '@application/shared/template-renderer.service';

const registration = { id: 'reg-1', name: 'João', email: 'j@test.com', phone: '+5511999998888' };

const rule = {
  id: 'rule-1',
  templateId: 'tpl-1',
  trigger: 'on_approval',
  formIds: [],
  template: { id: 'tpl-1', channel: 'whatsapp', subject: null, body: 'Oi {{nome}}' },
};

function makeEngine(status: string) {
  const automations = { findActiveTriggerRules: jest.fn().mockResolvedValue([rule]) };
  const eventRepo = {
    findAutomationContext: jest.fn().mockResolvedValue({
      id: 'evt-1',
      ownerId: 'owner-1',
      title: 'Tech Day',
      status,
      eventDate: new Date('2026-09-01T18:00:00Z'),
      location: 'SP',
      capacity: 100,
      dressCode: null,
      groupLink: null,
      whatsappToken: 'tok',
    }),
  };
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

describe('AutomationEngine — status do evento', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(['published', 'ended'])('dispatches on a %s event', async (status) => {
    const { engine, outbox } = makeEngine(status);

    await engine.fireAutomations('reg-1', 'evt-1', 'on_approval');

    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });

  // Rascunho ainda está sendo montado: aprovar um inscrito de teste não pode
  // mandar mensagem de verdade.
  it('does not dispatch on a draft event', async () => {
    const { engine, outbox } = makeEngine('draft');

    await engine.fireAutomations('reg-1', 'evt-1', 'on_approval');

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  // Cancelado já mandou o aviso de cancelamento, que vai direto ao outbox pelo
  // EventLifecycleService e não passa por aqui.
  it('does not dispatch on a cancelled event', async () => {
    const { engine, outbox } = makeEngine('cancelled');

    await engine.fireAutomations('reg-1', 'evt-1', 'on_approval');

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('blocks the form-submitted path too', async () => {
    const { engine, outbox } = makeEngine('draft');

    await engine.fireForForm('evt-1', 'form-1', {
      name: 'João',
      email: 'j@test.com',
      phone: '+5511999998888',
    });

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
});
