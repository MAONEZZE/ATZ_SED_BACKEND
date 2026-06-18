import { PostEventResponsesController } from '../../app/api/controllers/registrations/registrations_routes/post-event-responses.controller';

function make() {
  const prisma = {
    postEventResponse: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    formField: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const ctrl = new PostEventResponsesController(prisma as any);
  return { ctrl, prisma };
}

function fakeRes() {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.setHeader = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
}

describe('PostEventResponsesController', () => {
  beforeEach(() => jest.clearAllMocks());

  it('list returns paginated data scoped to the event with registration included', async () => {
    const { ctrl, prisma } = make();
    prisma.postEventResponse.findMany.mockResolvedValue([
      {
        id: 'p1',
        answers: {},
        createdAt: new Date(),
        registration: { id: 'r1', name: 'A', email: 'a@b.com', phone: '1' },
      },
    ]);
    prisma.postEventResponse.count.mockResolvedValue(1);

    const result = await ctrl.findAll('evt-1', { page: 2, limit: 10 });

    expect(prisma.postEventResponse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(prisma.postEventResponse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 'evt-1' },
        include: expect.objectContaining({
          registration: expect.objectContaining({
            select: { id: true, name: true, email: true, phone: true },
          }),
        }),
      }),
    );
    expect(prisma.postEventResponse.count).toHaveBeenCalledWith({ where: { eventId: 'evt-1' } });
    expect(result).toEqual({
      data: [
        {
          id: 'p1',
          answers: {},
          createdAt: expect.any(Date),
          registration: { id: 'r1', name: 'A', email: 'a@b.com', phone: '1' },
        },
      ],
      total: 1,
      page: 2,
      limit: 10,
    });
  });

  it('export sends CSV with proper headers and field labels', async () => {
    const { ctrl, prisma } = make();
    prisma.postEventResponse.findMany.mockResolvedValue([
      {
        id: 'p1',
        answers: { Nota: '9' },
        createdAt: new Date('2026-06-01T12:00:00Z'),
        registration: { name: 'A', email: 'a@b.com', phone: '1' },
      },
    ]);
    prisma.formField.findMany.mockResolvedValue([{ label: 'Nota' }]);
    const res = fakeRes();

    await ctrl.exportCsv('evt-1', res);

    expect(prisma.formField.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 'evt-1', kind: 'post_event' },
      }),
    );
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('respostas-pos-evento-evt-1-'),
    );
    const sent = res.send.mock.calls[0][0];
    expect(typeof sent).toBe('string');
    expect(sent).toContain('Nota');
  });
});
