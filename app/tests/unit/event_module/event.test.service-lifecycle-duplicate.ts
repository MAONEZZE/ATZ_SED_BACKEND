import { EventLifecycleService } from '@application/event_module/event-lifecycle.service';

function makeService(source: any, graphResult?: any) {
  const eventRepo = {
    findDuplicationSource: jest.fn().mockResolvedValue(source),
    createDuplicateGraph: jest.fn().mockResolvedValue(
      graphResult ?? {
        event: { id: 'evt-new', ownerId: 'user-9', title: 'x', slug: 's' },
        rules: [],
      },
    ),
  } as any;
  const outbox = {} as any;
  const scheduler = { upsert: jest.fn().mockResolvedValue(undefined) };
  const registrations = {} as any;
  const templates = {} as any;
  const service = new EventLifecycleService(
    eventRepo,
    scheduler as any,
    outbox,
    registrations,
    templates,
  );
  return { service, eventRepo, scheduler };
}

const FORM = {
  name: 'Inscrição',
  slug: 'inscricao',
  order: 0,
  description: 'Descrição original',
  postRegistrationMessage: 'Obrigado!',
  linkPostSubscription: null,
  sendToPipedrive: false,
  fields: [{ label: 'Nome', type: 'text', required: true, options: null, order: 0, isFixed: true }],
};

const TEMPLATE = {
  sourceId: 'tpl-1',
  name: 'Boas-vindas',
  channel: 'whatsapp',
  subject: null,
  body: 'Olá {{nome}}',
  layoutConfig: null,
  styleKey: null,
  order: 0,
};

function baseSource(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Tech Day',
    location: null,
    capacity: null,
    dressCode: null,
    groupLink: null,
    eventDate: null,
    endDate: null,
    folderId: null,
    folderOwnerId: null,
    forms: [FORM],
    templates: [TEMPLATE],
    automationRules: [],
    ...overrides,
  };
}

describe('EventLifecycleService.duplicate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes the source forms and templates through to createDuplicateGraph', async () => {
    const source = baseSource();
    const { service, eventRepo } = makeService(source);
    await service.duplicate('evt-1', 'user-9');

    const call = eventRepo.createDuplicateGraph.mock.calls[0][0];
    expect(call.forms).toEqual([FORM]);
    expect(call.templates).toEqual([TEMPLATE]);
  });

  it('titles the copy "(cópia)" and returns it in draft status', async () => {
    const source = baseSource();
    const { service } = makeService(source);
    const result = await service.duplicate('evt-1', 'user-9');

    expect(result.title).toBe('x');
    expect(result.status).toBe('draft');
  });

  it('stamps the duplicating user as owner and last editor on the new event payload', async () => {
    const source = baseSource();
    const { service, eventRepo } = makeService(source);
    await service.duplicate('evt-1', 'user-9');

    const call = eventRepo.createDuplicateGraph.mock.calls[0][0];
    expect(call.event).toEqual(
      expect.objectContaining({
        ownerId: 'user-9',
        title: 'Tech Day (cópia)',
        lastEditedById: 'user-9',
      }),
    );
  });

  it('inherits the source folder when it belongs to the duplicating user', async () => {
    const source = baseSource({ folderId: 'folder-1', folderOwnerId: 'user-9' });
    const { service, eventRepo } = makeService(source);
    await service.duplicate('evt-1', 'user-9');

    expect(eventRepo.createDuplicateGraph.mock.calls[0][0].event.folderId).toBe('folder-1');
  });

  it('drops to the root when the source folder belongs to a different user (collaborator duplicating)', async () => {
    const source = baseSource({ folderId: 'folder-1', folderOwnerId: 'someone-else' });
    const { service, eventRepo } = makeService(source);
    await service.duplicate('evt-1', 'user-9');

    expect(eventRepo.createDuplicateGraph.mock.calls[0][0].event.folderId).toBeNull();
  });

  it('sends folderId null when the source event has no folder', async () => {
    const source = baseSource({ folderId: null, folderOwnerId: null });
    const { service, eventRepo } = makeService(source);
    await service.duplicate('evt-1', 'user-9');

    expect(eventRepo.createDuplicateGraph.mock.calls[0][0].event.folderId).toBeNull();
  });
});

describe('EventLifecycleService.duplicate — automation rules', () => {
  beforeEach(() => jest.clearAllMocks());

  const RULE_IMMEDIATE = {
    templateId: 'tpl-1',
    trigger: 'on_form_submitted',
    delayMinutes: null,
    cron: null,
    timezone: null,
    sendAt: null,
    sendTime: null,
    name: null,
    active: true,
    order: 0,
    formSlugs: ['inscricao'],
  };

  const RULE_RECURRING = {
    templateId: 'tpl-recurring',
    trigger: 'recurring',
    delayMinutes: null,
    cron: '0 9 * * 1',
    timezone: 'America/Sao_Paulo',
    sendAt: null,
    sendTime: null,
    name: null,
    active: true,
    order: 1,
    formSlugs: [],
  };

  const RULE_ON_DATE = {
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
  };

  const RULE_ON_DATE_FORM_FIELD = {
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
  };

  it('keeps the source templateId and formSlugs on each rule sent to the graph (the repo remaps them)', async () => {
    const source = baseSource({ automationRules: [RULE_IMMEDIATE] });
    const { service, eventRepo } = makeService(source);
    await service.duplicate('evt-1', 'user-9');

    const rules = eventRepo.createDuplicateGraph.mock.calls[0][0].rules;
    expect(rules[0]).toEqual(
      expect.objectContaining({ templateId: 'tpl-1', formSlugs: ['inscricao'] }),
    );
  });

  it('every rule templateId sent to the graph is present among the templates sent', async () => {
    const source = baseSource({
      templates: [TEMPLATE, { ...TEMPLATE, sourceId: 'tpl-recurring' }],
      automationRules: [RULE_IMMEDIATE, RULE_RECURRING],
    });
    const { service, eventRepo } = makeService(source);
    await service.duplicate('evt-1', 'user-9');

    const call = eventRepo.createDuplicateGraph.mock.calls[0][0];
    const templateIds = new Set(call.templates.map((t: any) => t.sourceId));
    for (const rule of call.rules) expect(templateIds.has(rule.templateId)).toBe(true);
  });

  // A data de uma regra `on_date` é do evento de origem e pode já ter passado:
  // ativa, a varredura seguinte dispararia tudo de uma vez.
  it('copies an on_date rule deactivated, keeping its sendAt', async () => {
    const source = baseSource({ automationRules: [RULE_ON_DATE] });
    const { service, eventRepo } = makeService(source);
    await service.duplicate('evt-1', 'user-9');

    const rules = eventRepo.createDuplicateGraph.mock.calls[0][0].rules;
    expect(rules[0]).toEqual(
      expect.objectContaining({
        trigger: 'on_date',
        sendAt: new Date('2026-02-12T12:00:00Z'),
        active: false,
      }),
    );
  });

  // O evento novo nasce sem respostas: ativar de cara mandaria a mensagem sem
  // ninguém ter respondido nada. sendTime/name têm que sobreviver à cópia.
  it('copies an on_date_form_field rule deactivated, preserving sendTime and name', async () => {
    const source = baseSource({ automationRules: [RULE_ON_DATE_FORM_FIELD] });
    const { service, eventRepo } = makeService(source);
    await service.duplicate('evt-1', 'user-9');

    const rules = eventRepo.createDuplicateGraph.mock.calls[0][0].rules;
    expect(rules[0]).toEqual(
      expect.objectContaining({
        trigger: 'on_date_form_field',
        sendTime: '18:30',
        name: 'Cobrança mensal',
        active: false,
      }),
    );
  });

  it('keeps the other triggers active when duplicating', async () => {
    const source = baseSource({ automationRules: [RULE_IMMEDIATE, RULE_RECURRING] });
    const { service, eventRepo } = makeService(source);
    await service.duplicate('evt-1', 'user-9');

    const rules = eventRepo.createDuplicateGraph.mock.calls[0][0].rules;
    expect(rules[0].active).toBe(true);
    expect(rules[1].active).toBe(true);
  });

  // Regra `recurring` copiada ativa sem job scheduler no BullMQ só voltaria a
  // disparar no próximo boot; registrar aqui fecha essa janela.
  it('registers the BullMQ scheduler for a duplicated recurring rule, only after the graph resolves', async () => {
    const source = baseSource({ automationRules: [RULE_IMMEDIATE, RULE_RECURRING] });
    const { service, eventRepo, scheduler } = makeService(source);

    const order: string[] = [];
    eventRepo.createDuplicateGraph.mockImplementation(() => {
      order.push('graph');
      return Promise.resolve({
        event: { id: 'evt-new', ownerId: 'user-9', title: 'x', slug: 's' },
        rules: [
          {
            id: 'rule-new-2',
            trigger: 'recurring',
            cron: '0 9 * * 1',
            timezone: 'America/Sao_Paulo',
            active: true,
          },
        ],
      });
    });
    scheduler.upsert.mockImplementation(() => {
      order.push('scheduler');
      return Promise.resolve(undefined);
    });

    await service.duplicate('evt-1', 'user-9');

    expect(scheduler.upsert).toHaveBeenCalledTimes(1);
    expect(scheduler.upsert).toHaveBeenCalledWith({
      id: 'rule-new-2',
      cron: '0 9 * * 1',
      timezone: 'America/Sao_Paulo',
    });
    expect(order).toEqual(['graph', 'scheduler']);
  });

  it('does not register a scheduler for a duplicated inactive recurring rule', async () => {
    const source = baseSource({ automationRules: [RULE_RECURRING] });
    const { service, scheduler } = makeService(source, {
      event: { id: 'evt-new', ownerId: 'user-9', title: 'x', slug: 's' },
      rules: [
        {
          id: 'rule-new-2',
          trigger: 'recurring',
          cron: '0 9 * * 1',
          timezone: 'America/Sao_Paulo',
          active: false,
        },
      ],
    });

    await service.duplicate('evt-1', 'user-9');

    expect(scheduler.upsert).not.toHaveBeenCalled();
  });

  it('does not call the scheduler when createDuplicateGraph rejects', async () => {
    const source = baseSource({ automationRules: [RULE_RECURRING] });
    const { service, eventRepo, scheduler } = makeService(source);
    eventRepo.createDuplicateGraph.mockRejectedValue(new Error('boom'));

    await expect(service.duplicate('evt-1', 'user-9')).rejects.toThrow('boom');
    expect(scheduler.upsert).not.toHaveBeenCalled();
  });
});
