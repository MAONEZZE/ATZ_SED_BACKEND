import { TemplatesService } from '@application/message_template_module/templates.service';

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

    expect(repo.findAllForOwnerPaginated).toHaveBeenCalledWith('user-1', {}, { skip: 0, take: 20 });
  });

  // A query string não tem como carregar null, então o frontend manda a literal
  // 'null' para pedir só os templates globais. Traduzir isso é do service; a
  // porta recebe o null de verdade, que ela distingue de "sem filtro".
  it('translates the literal "null" eventId into an explicit null filter', async () => {
    const { svc, repo } = make();

    await svc.list('user-1', 'null', 1, 20);

    expect(repo.findAllForOwnerPaginated).toHaveBeenCalledWith(
      'user-1',
      { eventId: null },
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
