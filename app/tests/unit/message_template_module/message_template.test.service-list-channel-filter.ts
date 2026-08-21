import { MessageTemplateService } from '@application/message_template_module/message-template.service';

function make(eventAccessible = true) {
  const repo = {
    findAllForOwnerPaginated: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    eventAccessible: jest.fn().mockResolvedValue(eventAccessible),
  };
  const folders = { findById: jest.fn().mockResolvedValue(null) };
  const automations = { findActiveRuleByTemplate: jest.fn().mockResolvedValue(null) };
  const svc = new MessageTemplateService(repo as any, folders as any, automations as any);
  return { svc, repo, folders };
}

describe('MessageTemplateService.list channel filter', () => {
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

  // O escopo de evento passa a incluir templates de outro dono (do colaborador),
  // então o acesso ao evento precisa ser verificado antes de listar.
  it('checks event access before listing an event scope', async () => {
    const { svc, repo } = make();

    await svc.list('user-1', 'evt-1', 1, 20);

    expect(repo.eventAccessible).toHaveBeenCalledWith('evt-1', 'user-1');
  });

  it('rejects an event the user cannot reach', async () => {
    const { svc, repo } = make(false);

    await expect(svc.list('user-1', 'evt-1', 1, 20)).rejects.toThrow('Event not found');
    expect(repo.findAllForOwnerPaginated).not.toHaveBeenCalled();
  });

  it('does not check event access for the global scope', async () => {
    const { svc, repo } = make();

    await svc.list('user-1', 'null', 1, 20);

    expect(repo.eventAccessible).not.toHaveBeenCalled();
  });
});
