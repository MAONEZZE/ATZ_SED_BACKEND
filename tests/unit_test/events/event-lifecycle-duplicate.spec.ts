import { EventLifecycleService } from '@modules/events/event-lifecycle.service';

function makeService(source: any) {
  const prisma = {
    event: {
      findUnique: jest.fn().mockResolvedValue(source),
      create: jest.fn().mockResolvedValue({ id: 'evt-new', ownerId: 'user-9', title: 'x', slug: 's' }),
    },
    form: {
      create: jest.fn().mockResolvedValue({}),
    },
    automationRule: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  const eventRepo = {} as any;
  const outbox = {} as any;
  const service = new EventLifecycleService(eventRepo, outbox, prisma as any);
  return { service, prisma };
}

describe('EventLifecycleService.duplicate', () => {
  beforeEach(() => jest.clearAllMocks());

  const source = {
    id: 'evt-1',
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
        id: 'form-reg',
        kind: 'registration',
        description: 'Descrição original',
        postRegistrationMessage: 'Obrigado!',
        fields: [
          { label: 'Nome', type: 'text', required: true, options: null, order: 0, isFixed: true },
        ],
      },
      {
        id: 'form-post',
        kind: 'post_event',
        description: null,
        postRegistrationMessage: null,
        fields: [
          { label: 'Avaliação', type: 'text', required: false, options: null, order: 1, isFixed: false },
        ],
      },
    ],
    automationRules: [],
  };

  it('duplicates each Form (kind + description + postRegistrationMessage) with its fields', async () => {
    const { service, prisma } = makeService(source);
    await service.duplicate('evt-1', 'user-9');

    const calls = prisma.form.create.mock.calls.map((c) => c[0].data);
    expect(calls).toEqual([
      expect.objectContaining({
        eventId: 'evt-new',
        kind: 'registration',
        description: 'Descrição original',
        postRegistrationMessage: 'Obrigado!',
      }),
      expect.objectContaining({
        eventId: 'evt-new',
        kind: 'post_event',
        description: null,
        postRegistrationMessage: null,
      }),
    ]);
    expect(calls[0].fields.create).toEqual([
      expect.objectContaining({ label: 'Nome', isFixed: true }),
    ]);
    expect(calls[1].fields.create).toEqual([
      expect.objectContaining({ label: 'Avaliação', isFixed: false }),
    ]);
  });

  it('stamps the duplicating user as last editor on the new event', async () => {
    const { service, prisma } = makeService(source);
    await service.duplicate('evt-1', 'user-9');
    const created = prisma.event.create.mock.calls[0][0];
    expect(created.data.lastEditedById).toBe('user-9');
  });
});
