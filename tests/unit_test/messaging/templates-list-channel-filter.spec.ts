import { TemplatesService } from '@modules/messaging/templates.service';

function make() {
  const repo = {
    findAllForOwnerPaginated: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  };
  const svc = new TemplatesService(repo as any);
  return { svc, repo };
}

describe('TemplatesService.list channel filter', () => {
  it('includes channel in the where filter when provided', async () => {
    const { svc, repo } = make();

    await svc.list('user-1', undefined, 1, 20, 'whatsapp');

    expect(repo.findAllForOwnerPaginated).toHaveBeenCalledWith(
      'user-1',
      { channel: 'whatsapp' },
      { skip: 0, take: 20 },
    );
  });

  it('omits channel from the where filter when not provided', async () => {
    const { svc, repo } = make();

    await svc.list('user-1', undefined, 1, 20);

    expect(repo.findAllForOwnerPaginated).toHaveBeenCalledWith(
      'user-1',
      {},
      { skip: 0, take: 20 },
    );
  });

  it('combines eventId and channel filters', async () => {
    const { svc, repo } = make();

    await svc.list('user-1', 'evt-1', 1, 20, 'email');

    expect(repo.findAllForOwnerPaginated).toHaveBeenCalledWith(
      'user-1',
      { eventId: 'evt-1', channel: 'email' },
      { skip: 0, take: 20 },
    );
  });
});
