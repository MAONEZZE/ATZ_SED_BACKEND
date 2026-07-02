import { PublicEventsService } from '../../app/services/events/public-events.service';

function makeService(eventRow: any) {
  const prisma = {
    event: { findUnique: jest.fn().mockResolvedValue(eventRow) },
    formField: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { service: new PublicEventsService(prisma as any), prisma };
}

describe('PublicEventsService.getPublicFormFields (registration)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('only returns registration-kind fields', async () => {
    const { service, prisma } = makeService({ id: 'evt-1', status: 'published' });
    await service.getPublicFormFields('slug-1', 'registration', false);
    expect(prisma.formField.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: 'evt-1', kind: 'registration' } }),
    );
  });
});
