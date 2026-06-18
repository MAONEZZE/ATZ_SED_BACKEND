import { PublicEventsController } from '../../app/api/controllers/public/public-events.controller';
import { NotFoundException } from '@nestjs/common';

function makeController(eventRow: any) {
  const prisma = {
    event: { findUnique: jest.fn().mockResolvedValue(eventRow) },
    formField: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { ctrl: new PublicEventsController(prisma as any), prisma };
}

describe('PublicEventsController.getPostEventFields', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns post_event fields for a published event', async () => {
    const { ctrl, prisma } = makeController({ id: 'evt-1', status: 'published' });
    await ctrl.getPostEventFields('slug-1');
    expect(prisma.formField.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: 'evt-1', kind: 'post_event' } }),
    );
  });

  it('returns post_event fields for an ended event', async () => {
    const { ctrl, prisma } = makeController({ id: 'evt-1', status: 'ended' });
    await expect(ctrl.getPostEventFields('slug-1')).resolves.toBeDefined();
    expect(prisma.formField.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: 'evt-1', kind: 'post_event' } }),
    );
  });

  it('throws 404 for a draft event', async () => {
    const { ctrl } = makeController({ id: 'evt-1', status: 'draft' });
    await expect(ctrl.getPostEventFields('slug-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
