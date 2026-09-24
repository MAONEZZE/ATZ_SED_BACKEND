import { NotFoundException } from '@nestjs/common';
import { PublicEventService } from '@application/event_module/public-event.service';

function makeService(event: any) {
  const eventRepo = { findPublicBySlug: jest.fn().mockResolvedValue(event) };
  return { service: new PublicEventService(eventRepo as any), eventRepo };
}

describe('PublicEventService.getPublicEvent status gating', () => {
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

// Configurações pós-envio pertencem a cada formulário (GET /public/events/:slug/forms).
// O evento só mantém os campos antigos como deprecated, com valor neutro.
describe('PublicEventService.getPublicEvent deprecated form fields', () => {
  it('returns neutral values instead of copying any form', async () => {
    const { service } = makeService({ id: 'e1', status: 'published' });

    await expect(service.getPublicEvent('slug')).resolves.toMatchObject({
      description: null,
      postRegistrationMessage: null,
      linkPostSubscription: null,
      requireImageAuthorization: false,
    });
  });

  it('depends only on the event repository', () => {
    expect(PublicEventService.length).toBe(1);
  });
});
