import { EventLifecycleService } from '@modules/events/event-lifecycle.service';

function makeService(source: any) {
  const eventRepo = {
    findDuplicationSource: jest.fn().mockResolvedValue(source),
    createDuplicate: jest
      .fn()
      .mockResolvedValue({ id: 'evt-new', ownerId: 'user-9', title: 'x', slug: 's' }),
  } as any;
  const outbox = {} as any;
  const forms = { createWithFields: jest.fn().mockResolvedValue({}) };
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
