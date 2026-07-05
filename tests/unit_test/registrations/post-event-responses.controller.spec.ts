import { PostEventResponsesController } from '@modules/registrations/post-event-responses.controller';
import { PostEventResponsesService } from '@modules/registrations/post-event-responses.service';

function fakeRes() {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.setHeader = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
}

describe('PostEventResponsesService.listPaginated', () => {
  it('scopes the query to the event with registration included and paginates', async () => {
    const repo = {
      findAllByEventPaginated: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'p1',
            answers: {},
            createdAt: new Date(),
            registration: { id: 'r1', name: 'A', email: 'a@b.com', phone: '1' },
          },
        ],
        total: 1,
      }),
    };
    const service = new PostEventResponsesService(repo as any);
    const result = await service.listPaginated('evt-1', 2, 10);
    expect(repo.findAllByEventPaginated).toHaveBeenCalledWith(
      'evt-1',
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(result.total).toBe(1);
  });
});

describe('PostEventResponsesController CSV export (format=csv)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns CSV with proper headers and field labels', async () => {
    const postEventResponses = {
      exportRows: jest.fn().mockResolvedValue([
        {
          name: 'A',
          email: 'a@b.com',
          phone: '1',
          answers: { Nota: '9' },
          createdAt: new Date('2026-06-01T12:00:00Z'),
        },
      ]),
    };
    const formFields = { exportLabels: jest.fn().mockResolvedValue([{ label: 'Nota' }]) };
    const ctrl = new PostEventResponsesController(postEventResponses as any, formFields as any);
    const res = fakeRes();

    const sent = await ctrl.findAll('evt-1', { format: 'csv' } as any, res as any);

    expect(formFields.exportLabels).toHaveBeenCalledWith('evt-1', 'post_event');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('respostas-pos-evento-evt-1-'),
    );
    expect(typeof sent).toBe('string');
    expect(sent as string).toContain('Nota');
  });
});
