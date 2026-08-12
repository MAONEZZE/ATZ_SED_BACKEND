import { PublicEventService } from '@application/event_module/public-event.service';
import { NotFoundException } from '@nestjs/common';

function makeService(eventRow: any) {
  const eventRepo = { findStatusBySlug: jest.fn().mockResolvedValue(eventRow) };
  const forms = {};
  const formFields = { listPublicByEventAndKind: jest.fn().mockResolvedValue([]) };
  return {
    service: new PublicEventService(eventRepo as any, forms as any, formFields as any),
    eventRepo,
    formFields,
  };
}

describe('PublicEventService.getPublicFormFields (post_event)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns post_event fields for a published event', async () => {
    const { service, formFields } = makeService({ id: 'evt-1', status: 'published' });
    await service.getPublicFormFields('slug-1', 'post_event', true);
    expect(formFields.listPublicByEventAndKind).toHaveBeenCalledWith('evt-1', 'post_event');
  });

  it('returns post_event fields for an ended event', async () => {
    const { service, formFields } = makeService({ id: 'evt-1', status: 'ended' });
    await expect(service.getPublicFormFields('slug-1', 'post_event', true)).resolves.toBeDefined();
    expect(formFields.listPublicByEventAndKind).toHaveBeenCalledWith('evt-1', 'post_event');
  });

  it('throws 404 for a draft event', async () => {
    const { service } = makeService({ id: 'evt-1', status: 'draft' });
    await expect(service.getPublicFormFields('slug-1', 'post_event', true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
