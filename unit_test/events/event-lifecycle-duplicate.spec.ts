import { EventLifecycleService } from '../../app/services/events/event-lifecycle.service';

function makeService(source: any) {
  const prisma = {
    event: {
      findUnique: jest.fn().mockResolvedValue(source),
      create: jest.fn().mockResolvedValue({ id: 'evt-new', ownerId: 'user-9', title: 'x', slug: 's' }),
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
    description: null,
    location: null,
    capacity: null,
    dressCode: null,
    groupLink: null,
    eventDate: null,
    endDate: null,
    postRegistrationMessage: null,
    formFields: [
      { label: 'Nome', type: 'text', required: true, options: null, order: 0, isFixed: true, kind: 'registration' },
      { label: 'Avaliação', type: 'text', required: false, options: null, order: 1, isFixed: false, kind: 'post_event' },
    ],
    automationRules: [],
  };

  it('copies the kind of each form field (post_event survives duplication)', async () => {
    const { service, prisma } = makeService(source);
    await service.duplicate('evt-1', 'user-9');
    const created = prisma.event.create.mock.calls[0][0];
    const kinds = created.data.formFields.create.map((f: any) => f.kind);
    expect(kinds).toEqual(['registration', 'post_event']);
  });

  it('stamps the duplicating user as last editor on the new event', async () => {
    const { service, prisma } = makeService(source);
    await service.duplicate('evt-1', 'user-9');
    const created = prisma.event.create.mock.calls[0][0];
    expect(created.data.lastEditedById).toBe('user-9');
  });
});
