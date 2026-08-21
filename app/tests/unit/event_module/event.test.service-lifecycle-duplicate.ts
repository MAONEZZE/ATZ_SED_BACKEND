import { EventLifecycleService } from '@application/event_module/event-lifecycle.service';

function makeService(source: any, formsOverride?: Record<string, jest.Mock>) {
  const eventRepo = {
    findDuplicationSource: jest.fn().mockResolvedValue(source),
    createDuplicate: jest
      .fn()
      .mockResolvedValue({ id: 'evt-new', ownerId: 'user-9', title: 'x', slug: 's' }),
  } as any;
  const outbox = {} as any;
  const forms = formsOverride ?? { createWithFields: jest.fn().mockResolvedValue({}) };
  const automations = { createManyForDuplication: jest.fn().mockResolvedValue([]) };
  const scheduler = { upsert: jest.fn().mockResolvedValue(undefined) };
  const registrations = {} as any;
  const templates = {} as any;
  const service = new EventLifecycleService(
    eventRepo,
    scheduler as any,
    outbox,
    forms as any,
    automations as any,
    registrations,
    templates,
  );
  return { service, eventRepo, forms, automations, scheduler };
}

describe('EventLifecycleService.duplicate', () => {
  beforeEach(() => jest.clearAllMocks());

  const source = {
    title: 'Tech Day',
    location: null,
    capacity: null,
    dressCode: null,
    groupLink: null,
    eventDate: null,
    endDate: null,
    forms: [
      {
        kind: 'registration',
        description: 'Descrição original',
        postRegistrationMessage: 'Obrigado!',
        linkPostSubscription: null,
        fields: [
          { label: 'Nome', type: 'text', required: true, options: null, order: 0, isFixed: true },
        ],
      },
      {
        kind: 'post_event',
        description: null,
        postRegistrationMessage: null,
        linkPostSubscription: null,
        fields: [
          {
            label: 'Avaliação',
            type: 'text',
            required: false,
            options: null,
            order: 1,
            isFixed: false,
          },
        ],
      },
    ],
    automationRules: [],
  };

  it('duplicates each Form (kind + description + postRegistrationMessage) with its fields', async () => {
    const { service, forms } = makeService(source);
    await service.duplicate('evt-1', 'user-9');

    const calls = forms.createWithFields.mock.calls;
    expect(calls[0]).toEqual([
      'evt-new',
      expect.objectContaining({
        kind: 'registration',
        description: 'Descrição original',
        postRegistrationMessage: 'Obrigado!',
      }),
    ]);
    expect(calls[1]).toEqual([
      'evt-new',
      expect.objectContaining({
        kind: 'post_event',
        description: null,
        postRegistrationMessage: null,
      }),
    ]);
    expect(calls[0][1].fields).toEqual([
      expect.objectContaining({ label: 'Nome', isFixed: true }),
    ]);
    expect(calls[1][1].fields).toEqual([
      expect.objectContaining({ label: 'Avaliação', isFixed: false }),
    ]);
  });

  it('stamps the duplicating user as last editor on the new event', async () => {
    const { service, eventRepo } = makeService(source);
    await service.duplicate('evt-1', 'user-9');
    const created = eventRepo.createDuplicate.mock.calls[0][0];
    expect(created.lastEditedById).toBe('user-9');
  });
});

// `formSlugs` (não formId) é o que a fonte carrega: o formulário antigo não
// existe no evento novo, só um com o mesmo slug (createWithFields preserva).
describe('EventLifecycleService.duplicate — automation rules with formIds', () => {
  beforeEach(() => jest.clearAllMocks());

  const sourceWithRules = {
    title: 'Tech Day',
    location: null,
    capacity: null,
    dressCode: null,
    groupLink: null,
    eventDate: null,
    endDate: null,
    forms: [{ slug: 'inscricao', fields: [] }],
    automationRules: [
      {
        templateId: 'tpl-1',
        trigger: 'on_form_submitted',
        delayMinutes: null,
        cron: null,
        timezone: null,
        active: true,
        order: 0,
        formSlugs: ['inscricao'],
      },
      {
        templateId: 'tpl-recurring',
        trigger: 'recurring',
        delayMinutes: null,
        cron: '0 9 * * 1',
        timezone: 'America/Sao_Paulo',
        active: true,
        order: 1,
        formSlugs: [],
      },
      {
        templateId: 'tpl-data',
        trigger: 'on_date',
        delayMinutes: null,
        cron: null,
        timezone: 'America/Sao_Paulo',
        sendAt: new Date('2026-02-12T12:00:00Z'),
        sendTime: null,
        name: null,
        active: true,
        order: 2,
        formSlugs: [],
      },
      {
        templateId: 'tpl-monthly',
        trigger: 'on_date_form_field',
        delayMinutes: null,
        cron: null,
        timezone: 'America/Sao_Paulo',
        sendAt: null,
        sendTime: '18:30',
        name: 'Cobrança mensal',
        active: true,
        order: 3,
        formSlugs: [],
      },
    ],
  };

  function makeServiceWithNewForm() {
    return makeService(sourceWithRules, {
      createWithFields: jest.fn().mockResolvedValue({ id: 'form-new-1', slug: 'inscricao' }),
    });
  }

  it('remaps formSlugs to the newly created form ids', async () => {
    const { service, automations } = makeServiceWithNewForm();
    await service.duplicate('evt-1', 'user-9');

    const rules = automations.createManyForDuplication.mock.calls[0][1];
    expect(rules[0]).toEqual(
      expect.objectContaining({ templateId: 'tpl-1', formIds: ['form-new-1'] }),
    );
    expect(rules[0]).not.toHaveProperty('formSlugs');
  });

  // A regra copiada carrega a data do evento de origem, que pode já ter passado:
  // ativa, a varredura seguinte dispararia tudo de uma vez.
  it('copies an on_date rule deactivated, keeping its sendAt', async () => {
    const { service, automations } = makeServiceWithNewForm();
    await service.duplicate('evt-1', 'user-9');

    const rules = automations.createManyForDuplication.mock.calls[0][1];
    expect(rules[2]).toEqual(
      expect.objectContaining({
        templateId: 'tpl-data',
        trigger: 'on_date',
        sendAt: new Date('2026-02-12T12:00:00Z'),
        active: false,
      }),
    );
  });

  it('keeps the other triggers active when duplicating', async () => {
    const { service, automations } = makeServiceWithNewForm();
    await service.duplicate('evt-1', 'user-9');

    const rules = automations.createManyForDuplication.mock.calls[0][1];
    expect(rules[0].active).toBe(true);
    expect(rules[1].active).toBe(true);
  });

  // Regra copiada ativa sem scheduler no BullMQ não dispara até o próximo boot
  // (quando o syncAll do worker reconcilia). Registrar na hora fecha a janela.
  it('registers the BullMQ scheduler for a duplicated recurring rule', async () => {
    const { service, automations, scheduler } = makeServiceWithNewForm();
    automations.createManyForDuplication.mockResolvedValue([
      { id: 'rule-new-1', trigger: 'on_form_submitted', cron: null, timezone: null, active: true },
      {
        id: 'rule-new-2',
        trigger: 'recurring',
        cron: '0 9 * * 1',
        timezone: 'America/Sao_Paulo',
        active: true,
      },
    ]);

    await service.duplicate('evt-1', 'user-9');

    expect(scheduler.upsert).toHaveBeenCalledTimes(1);
    expect(scheduler.upsert).toHaveBeenCalledWith({
      id: 'rule-new-2',
      cron: '0 9 * * 1',
      timezone: 'America/Sao_Paulo',
    });
  });

  it('does not register a scheduler for a duplicated inactive recurring rule', async () => {
    const { service, automations, scheduler } = makeServiceWithNewForm();
    automations.createManyForDuplication.mockResolvedValue([
      {
        id: 'rule-new-2',
        trigger: 'recurring',
        cron: '0 9 * * 1',
        timezone: 'America/Sao_Paulo',
        active: false,
      },
    ]);

    await service.duplicate('evt-1', 'user-9');

    expect(scheduler.upsert).not.toHaveBeenCalled();
  });

  // O evento novo nasce sem respostas: ativar de cara mandaria a mensagem sem
  // ninguém ter respondido nada. sendTime/name têm que sobreviver à cópia,
  // senão a regra ressuscita em 09:00 silenciosamente.
  it('copies an on_date_form_field rule deactivated, preserving sendTime and name', async () => {
    const { service, automations } = makeServiceWithNewForm();
    await service.duplicate('evt-1', 'user-9');

    const rules = automations.createManyForDuplication.mock.calls[0][1];
    expect(rules[3]).toEqual(
      expect.objectContaining({
        templateId: 'tpl-monthly',
        trigger: 'on_date_form_field',
        sendTime: '18:30',
        name: 'Cobrança mensal',
        active: false,
      }),
    );
  });

  it('carries cron, timezone and order over for a recurring rule with no form scope', async () => {
    const { service, automations } = makeServiceWithNewForm();
    await service.duplicate('evt-1', 'user-9');

    const rules = automations.createManyForDuplication.mock.calls[0][1];
    expect(rules[1]).toEqual(
      expect.objectContaining({
        templateId: 'tpl-recurring',
        cron: '0 9 * * 1',
        timezone: 'America/Sao_Paulo',
        order: 1,
        formIds: [],
      }),
    );
  });
});
