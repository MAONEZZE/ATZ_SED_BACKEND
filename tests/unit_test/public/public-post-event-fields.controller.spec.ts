import { PublicEventsService } from '@modules/events/public-events.service';
import { NotFoundException } from '@nestjs/common';

function makeService(eventRow: any) {
  const prisma = {
    event: { findUnique: jest.fn().mockResolvedValue(eventRow) },
    formField: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { service: new PublicEventsService(prisma as any), prisma };
}

describe('PublicEventsService.getPublicFormFields (post_event)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns post_event fields for a published event', async () => {
    const { service, prisma } = makeService({ id: 'evt-1', status: 'published' });
    await service.getPublicFormFields('slug-1', 'post_event', true);
    expect(prisma.formField.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: 'evt-1', kind: 'post_event' } }),
    );
  });

  it('returns post_event fields for an ended event', async () => {
    const { service, prisma } = makeService({ id: 'evt-1', status: 'ended' });
    await expect(service.getPublicFormFields('slug-1', 'post_event', true)).resolves.toBeDefined();
    expect(prisma.formField.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: 'evt-1', kind: 'post_event' } }),
    );
  });

  it('throws 404 for a draft event', async () => {
    const { service } = makeService({ id: 'evt-1', status: 'draft' });
    await expect(service.getPublicFormFields('slug-1', 'post_event', true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
