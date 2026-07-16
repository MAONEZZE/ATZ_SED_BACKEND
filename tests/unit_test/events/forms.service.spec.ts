import { FormsService } from '@modules/events/forms.service';

function makeService(existing: Record<string, unknown> | null = null) {
  const repo = {
    findByEventAndKind: jest.fn().mockResolvedValue(existing),
    create: jest.fn().mockResolvedValue({ id: 'form-new', eventId: 'evt-1', kind: 'registration' }),
    update: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
  };
  return { service: new FormsService(repo as any), repo };
}

describe('FormsService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getOrCreate', () => {
    it('returns the existing form when one is already present', async () => {
      const { service, repo } = makeService({ id: 'form-1', eventId: 'evt-1', kind: 'registration' });
      const form = await service.getOrCreate('evt-1', 'registration');
      expect(form).toEqual({ id: 'form-1', eventId: 'evt-1', kind: 'registration' });
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('creates an empty form on first access when none exists', async () => {
      const { service, repo } = makeService(null);
      const form = await service.getOrCreate('evt-1', 'post_event');
      expect(repo.create).toHaveBeenCalledWith('evt-1', 'post_event');
      expect(form).toEqual({ id: 'form-new', eventId: 'evt-1', kind: 'registration' });
    });
  });

  describe('update', () => {
    it('creates the form first when it does not exist, then updates it', async () => {
      const { service, repo } = makeService(null);
      await service.update('evt-1', 'registration', { description: 'Nova descrição' });
      expect(repo.create).toHaveBeenCalledWith('evt-1', 'registration');
      expect(repo.update).toHaveBeenCalledWith('form-new', { description: 'Nova descrição' });
    });

    it('only patches the fields provided', async () => {
      const { service, repo } = makeService({ id: 'form-1', eventId: 'evt-1', kind: 'registration' });
      await service.update('evt-1', 'registration', { postRegistrationMessage: 'Obrigado!' });
      expect(repo.update).toHaveBeenCalledWith('form-1', { postRegistrationMessage: 'Obrigado!' });
    });

    it('patches both fields when both are provided', async () => {
      const { service, repo } = makeService({ id: 'form-1', eventId: 'evt-1', kind: 'registration' });
      await service.update('evt-1', 'registration', {
        description: 'D',
        postRegistrationMessage: 'M',
      });
      expect(repo.update).toHaveBeenCalledWith('form-1', {
        description: 'D',
        postRegistrationMessage: 'M',
      });
    });
  });
});
