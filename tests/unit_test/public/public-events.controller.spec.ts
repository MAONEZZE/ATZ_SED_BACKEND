import { NotFoundException } from '@nestjs/common';
import { PublicEventsService } from '@modules/events/public-events.service';

function makeService(event: any) {
  const prisma = {
    event: { findUnique: jest.fn().mockResolvedValue(event) },
    form: { findUnique: jest.fn().mockResolvedValue(null) },
    formField: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { service: new PublicEventsService(prisma as any), prisma };
}

describe('PublicEventsService.getPublicEvent status gating', () => {
  it('returns a published event', async () => {
    const { service } = makeService({ id: 'e1', status: 'published' });
    await expect(service.getPublicEvent('slug')).resolves.toMatchObject({ status: 'published' });
  });

  it('returns an ended event (post-event page still loads details)', async () => {
    const { service } = makeService({ id: 'e1', status: 'ended' });
    await expect(service.getPublicEvent('slug')).resolves.toMatchObject({ status: 'ended' });
  });

  it('404 for draft events', async () => {
    const { service } = makeService({ id: 'e1', status: 'draft' });
    await expect(service.getPublicEvent('slug')).rejects.toThrow(NotFoundException);
  });

  it('404 when event missing', async () => {
    const { service } = makeService(null);
    await expect(service.getPublicEvent('slug')).rejects.toThrow(NotFoundException);
  });
});
