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
  const automations = { createManyForDuplication: jest.fn().mockResolvedValue({ count: 0 }) };
  const registrations = {} as any;
  const templates = {} as any;
  const service = new EventLifecycleService(
    eventRepo,
    outbox,
    forms as any,
    automations as any,
    registrations,
    templates,
  );
  return { service, eventRepo, forms, automations };
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
    sendToPipedrive: false,
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
    sendToPipedrive: false,
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
