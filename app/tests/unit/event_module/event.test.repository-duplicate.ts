import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaEventRepository } from '@infra/repositories/event_module/prisma-event.repository';
import {
  CreateDuplicateEventGraphData,
  EventDuplicationAutomationRule,
  EventDuplicationForm,
  EventDuplicationTemplate,
} from '@domain/event_module/i-repository-event';

function makeRepo(event: Record<string, jest.Mock>, transaction?: jest.Mock) {
  const prisma = { event, $transaction: transaction ?? jest.fn() } as unknown as PrismaService;
  return { repo: new PrismaEventRepository(prisma) };
}

const OWN_TEMPLATE = {
  id: 'tpl-own',
  name: 'Boas-vindas',
  channel: 'whatsapp',
  subject: null,
  body: 'Olá',
  layoutConfig: null,
  styleKey: null,
  eventId: 'evt-1',
  order: 0,
};

const GLOBAL_TEMPLATE = {
  id: 'tpl-global',
  name: 'Lembrete',
  channel: 'email',
  subject: 'Oi',
  body: 'Corpo',
  layoutConfig: null,
  styleKey: null,
  eventId: null,
  order: 1,
};

function ruleRow(overrides: Record<string, unknown>) {
  return {
    templateId: 'tpl-global',
    trigger: 'on_approval',
    delayMinutes: null,
    cron: null,
    timezone: null,
    sendAt: null,
    sendTime: null,
    name: null,
    active: true,
    order: 0,
    template: GLOBAL_TEMPLATE,
    forms: [],
    ...overrides,
  };
}

describe('PrismaEventRepository.findDuplicationSource', () => {
  it('dedupes a template referenced by several rules, alongside the event own templates', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      title: 'Tech Day',
      location: null,
      capacity: null,
      dressCode: null,
      groupLink: null,
      eventDate: null,
      endDate: null,
      folderId: null,
      folder: null,
      forms: [],
      messageTemplates: [OWN_TEMPLATE],
      automationRules: [
        ruleRow({ trigger: 'on_approval', order: 0 }),
        ruleRow({ trigger: 'on_registration', order: 1 }),
      ],
    });
    const { repo } = makeRepo({ findUnique });

    const source = await repo.findDuplicationSource('evt-1');

    expect(source!.templates.map((t) => t.sourceId).sort()).toEqual(['tpl-global', 'tpl-own']);
  });

  it('includes a template from another event when a rule references it', async () => {
    const OTHER_EVENT_TEMPLATE = {
      ...GLOBAL_TEMPLATE,
      id: 'tpl-other-event',
      eventId: 'evt-other',
    };
    const findUnique = jest.fn().mockResolvedValue({
      title: 'Tech Day',
      location: null,
      capacity: null,
      dressCode: null,
      groupLink: null,
      eventDate: null,
      endDate: null,
      folderId: null,
      folder: null,
      forms: [],
      messageTemplates: [],
      automationRules: [ruleRow({ templateId: 'tpl-other-event', template: OTHER_EVENT_TEMPLATE })],
    });
    const { repo } = makeRepo({ findUnique });

    const source = await repo.findDuplicationSource('evt-1');

    expect(source!.templates).toEqual([expect.objectContaining({ sourceId: 'tpl-other-event' })]);
  });

  it('returns folderId and folderOwnerId from the source event folder', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      title: 'Tech Day',
      location: null,
      capacity: null,
      dressCode: null,
      groupLink: null,
      eventDate: null,
      endDate: null,
      folderId: 'fld-1',
      folder: { ownerId: 'owner-1' },
      forms: [],
      messageTemplates: [],
      automationRules: [],
    });
    const { repo } = makeRepo({ findUnique });

    const source = await repo.findDuplicationSource('evt-1');

    expect(source!.folderId).toBe('fld-1');
    expect(source!.folderOwnerId).toBe('owner-1');
  });

  it('returns folderOwnerId null when the event has no folder', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      title: 'Tech Day',
      location: null,
      capacity: null,
      dressCode: null,
      groupLink: null,
      eventDate: null,
      endDate: null,
      folderId: null,
      folder: null,
      forms: [],
      messageTemplates: [],
      automationRules: [],
    });
    const { repo } = makeRepo({ findUnique });

    const source = await repo.findDuplicationSource('evt-1');

    expect(source!.folderOwnerId).toBeNull();
  });
});

describe('PrismaEventRepository.createDuplicateGraph', () => {
  function makeTx() {
    const eventCreate = jest.fn().mockResolvedValue({
      id: 'evt-new',
      ownerId: 'user-9',
      title: 'Tech Day (cópia)',
      slug: 's',
    });
    const formCreate = jest.fn().mockResolvedValue({ id: 'form-new-1', slug: 'inscricao' });
    const templateCreate = jest.fn().mockResolvedValue({ id: 'tpl-new-1' });
    const ruleCreate = jest.fn().mockResolvedValue({
      id: 'rule-new-1',
      trigger: 'on_form_submitted',
      cron: null,
      timezone: null,
      active: true,
    });
    const tx = {
      event: { create: eventCreate },
      form: { create: formCreate },
      messageTemplate: { create: templateCreate },
      automationRule: { create: ruleCreate },
    };
    return { tx, eventCreate, formCreate, templateCreate, ruleCreate };
  }

  const FORM: EventDuplicationForm = {
    name: 'Inscrição',
    slug: 'inscricao',
    order: 0,
    description: null,
    postRegistrationMessage: null,
    linkPostSubscription: null,
    sendToPipedrive: false,
    fields: [],
  };

  const TEMPLATE: EventDuplicationTemplate = {
    sourceId: 'tpl-1',
    name: 'Boas-vindas',
    channel: 'whatsapp',
    subject: null,
    body: 'Olá',
    layoutConfig: null,
    styleKey: null,
    order: 0,
  };

  function baseGraph(rules: EventDuplicationAutomationRule[]): CreateDuplicateEventGraphData {
    return {
      event: {
        ownerId: 'user-9',
        title: 'Tech Day (cópia)',
        slug: 's',
        location: null,
        capacity: null,
        dressCode: null,
        groupLink: null,
        eventDate: null,
        endDate: null,
        lastEditedById: 'user-9',
        folderId: null,
      },
      forms: [FORM],
      templates: [TEMPLATE],
      rules,
    };
  }

  it('creates the rule with the new template id and the new formIds, dropping a slug with no matching form', async () => {
    const { tx, ruleCreate } = makeTx();
    const $transaction = jest.fn((cb: (tx: unknown) => unknown) => cb(tx));
    const { repo } = makeRepo({}, $transaction);

    await repo.createDuplicateGraph(
      baseGraph([
        {
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
          formSlugs: ['inscricao', 'slug-inexistente'],
        },
      ]),
    );

    expect(ruleCreate.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        eventId: 'evt-new',
        templateId: 'tpl-new-1',
        forms: { create: [{ formId: 'form-new-1' }] },
      }),
    );
  });

  it('runs every write of the graph inside the same interactive transaction', async () => {
    const { tx, eventCreate, formCreate, templateCreate, ruleCreate } = makeTx();
    const $transaction = jest.fn((cb: (tx: unknown) => unknown) => cb(tx));
    const { repo } = makeRepo({}, $transaction);

    await repo.createDuplicateGraph(
      baseGraph([
        {
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
        },
      ]),
    );

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(eventCreate).toHaveBeenCalledTimes(1);
    expect(formCreate).toHaveBeenCalledTimes(1);
    expect(templateCreate).toHaveBeenCalledTimes(1);
    expect(ruleCreate).toHaveBeenCalledTimes(1);
  });

  // Não deveria acontecer — `findDuplicationSource` garante que todo template
  // referenciado por uma regra está em `templates` — mas se acontecer, a
  // transação inteira falha em vez de gravar uma regra com template errado.
  it('throws when a rule references a source template id absent from templates', async () => {
    const { tx } = makeTx();
    const $transaction = jest.fn((cb: (tx: unknown) => unknown) => cb(tx));
    const { repo } = makeRepo({}, $transaction);

    await expect(
      repo.createDuplicateGraph({
        ...baseGraph([]),
        templates: [],
        rules: [
          {
            templateId: 'tpl-missing',
            trigger: 'on_approval',
            delayMinutes: null,
            cron: null,
            timezone: null,
            sendAt: null,
            sendTime: null,
            name: null,
            active: true,
            order: 0,
            formSlugs: [],
          },
        ],
      }),
    ).rejects.toThrow();
  });
});
