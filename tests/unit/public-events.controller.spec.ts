import { NotFoundException } from '@nestjs/common';
import { PublicEventsController } from '../../app/api/controllers/public/public-events.controller';

function makeController(event: any) {
  const prisma = {
    event: { findUnique: jest.fn().mockResolvedValue(event) },
    formField: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { ctrl: new PublicEventsController(prisma as any), prisma };
}

describe('PublicEventsController.getPublicEvent status gating', () => {
  it('returns a published event', async () => {
    const { ctrl } = makeController({ id: 'e1', status: 'published' });
    await expect(ctrl.getPublicEvent('slug')).resolves.toMatchObject({ status: 'published' });
  });

  it('returns an ended event (post-event page still loads details)', async () => {
    const { ctrl } = makeController({ id: 'e1', status: 'ended' });
    await expect(ctrl.getPublicEvent('slug')).resolves.toMatchObject({ status: 'ended' });
  });

  it('404 for draft events', async () => {
    const { ctrl } = makeController({ id: 'e1', status: 'draft' });
    await expect(ctrl.getPublicEvent('slug')).rejects.toThrow(NotFoundException);
  });

  it('404 when event missing', async () => {
    const { ctrl } = makeController(null);
    await expect(ctrl.getPublicEvent('slug')).rejects.toThrow(NotFoundException);
  });
});
