import { UserSubscriptionsService } from '../../app/services/registrations/user-subscriptions.service';

function make(existing: any = null) {
  const repo = {
    findByEventAndContact: jest.fn().mockResolvedValue(existing),
    create: jest.fn().mockResolvedValue({ id: 'us-1' }),
    update: jest.fn().mockResolvedValue({ id: existing?.id ?? 'us-1' }),
  };
  const svc = new UserSubscriptionsService(repo as any);
  return { svc, repo };
}

describe('UserSubscriptionsService.upsertFromForm', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a new subscription when no match exists', async () => {
    const { svc, repo } = make(null);
    const answers = { nome: 'João', email: 'joao@b.com', telefone: '11999990000' };

    await svc.upsertFromForm('evt-1', 'registration', answers);

    expect(repo.findByEventAndContact).toHaveBeenCalledWith('evt-1', {
      email: 'joao@b.com',
      phone: '11999990000',
    });
    expect(repo.create).toHaveBeenCalledWith({
      eventId: 'evt-1',
      contact: { name: 'João', email: 'joao@b.com', phone: '11999990000' },
      kind: 'registration',
      answers,
    });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('updates an existing subscription matched by email/phone', async () => {
    const { svc, repo } = make({ id: 'us-9' });
    const answers = { email: 'joao@b.com' };

    await svc.upsertFromForm('evt-1', 'post_event', answers);

    expect(repo.update).toHaveBeenCalledWith('us-9', {
      contact: { name: undefined, email: 'joao@b.com', phone: undefined },
      kind: 'post_event',
      answers,
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('prefers an explicit contact override over the answers', async () => {
    const { svc, repo } = make(null);
    const answers = { Nota: '10' };

    await svc.upsertFromForm('evt-1', 'nps', answers, {
      name: 'Maria',
      email: 'maria@b.com',
      phone: '21988887777',
    });

    expect(repo.create).toHaveBeenCalledWith({
      eventId: 'evt-1',
      contact: { name: 'Maria', email: 'maria@b.com', phone: '21988887777' },
      kind: 'nps',
      answers,
    });
  });

  it('skips lookup when there is no email or phone', async () => {
    const { svc, repo } = make(null);
    await svc.upsertFromForm('evt-1', 'nps', { Nota: '10' });
    expect(repo.findByEventAndContact).not.toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalled();
  });
});
