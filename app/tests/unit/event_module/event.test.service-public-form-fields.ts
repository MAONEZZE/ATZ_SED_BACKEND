import { PublicEventService } from '@application/event_module/public-event.service';

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

describe('PublicEventService.getPublicFormFields (registration)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('only returns registration-kind fields', async () => {
    const { service, formFields } = makeService({ id: 'evt-1', status: 'published' });
    await service.getPublicFormFields('slug-1', 'registration', false);
    expect(formFields.listPublicByEventAndKind).toHaveBeenCalledWith('evt-1', 'registration');
  });
});
