import { PublicPostEventController } from '../../app/api/controllers/public/public-post-event.controller';

function make() {
  const prisma = {
    event: { findUnique: jest.fn().mockResolvedValue({ id: 'evt-1' }) },
    formField: {
      findMany: jest.fn().mockResolvedValue([{ label: 'Nota', required: true }]),
    },
  };
  const registrations = { submitPostEvent: jest.fn().mockResolvedValue(undefined) };
  return { ctrl: new PublicPostEventController(registrations as any, prisma as any), prisma, registrations };
}

describe('PublicPostEventController.submit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads post_event fields and forwards to the service', async () => {
    const { ctrl, prisma, registrations } = make();
    await ctrl.submit('slug-1', { identifier: 'a@b.com', answers: { Nota: '10' } } as any);
    expect(prisma.formField.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { event: { slug: 'slug-1' }, kind: 'post_event' } }),
    );
    expect(registrations.submitPostEvent).toHaveBeenCalledWith(
      'slug-1',
      'a@b.com',
      { Nota: '10' },
      [{ label: 'Nota', required: true }],
    );
  });
});
