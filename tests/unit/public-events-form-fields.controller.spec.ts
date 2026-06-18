import { PublicEventsController } from '../../app/api/controllers/public/public-events.controller';

function makeController(eventRow: any) {
  const prisma = {
    event: { findUnique: jest.fn().mockResolvedValue(eventRow) },
    formField: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { ctrl: new PublicEventsController(prisma as any), prisma };
}

describe('PublicEventsController.getFormFields', () => {
  beforeEach(() => jest.clearAllMocks());

  it('only returns registration-kind fields', async () => {
    const { ctrl, prisma } = makeController({ id: 'evt-1', status: 'published' });
    await ctrl.getFormFields('slug-1');
    expect(prisma.formField.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: 'evt-1', kind: 'registration' } }),
    );
  });
});
