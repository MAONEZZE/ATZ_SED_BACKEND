import { NotFoundException } from '@nestjs/common';
import { PublicEventsService } from '@application/event_module/public-events.service';

function makeService(event: any) {
  const eventRepo = { findPublicBySlug: jest.fn().mockResolvedValue(event) };
  const forms = { findByEventAndKind: jest.fn().mockResolvedValue(null) };
  const formFields = { listPublicByEventAndKind: jest.fn().mockResolvedValue([]) };
  return {
    service: new PublicEventsService(eventRepo as any, forms as any, formFields as any),
    eventRepo,
    forms,
    formFields,
  };
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
