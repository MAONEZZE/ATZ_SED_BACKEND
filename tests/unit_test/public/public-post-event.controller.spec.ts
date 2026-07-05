import { PublicPostEventController } from '@modules/public/public-post-event.controller';

function make() {
  const publicEvents = {
    getSubmissionFields: jest.fn().mockResolvedValue([{ label: 'Nota', required: true }]),
  };
  const registrations = { submitPostEvent: jest.fn().mockResolvedValue(undefined) };
  return {
    ctrl: new PublicPostEventController(registrations as any, publicEvents as any),
    publicEvents,
    registrations,
  };
}

describe('PublicPostEventController.submit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads post_event fields and forwards to the service', async () => {
    const { ctrl, publicEvents, registrations } = make();
    await ctrl.submit('slug-1', { identifier: 'a@b.com', answers: { Nota: '10' } });
    expect(publicEvents.getSubmissionFields).toHaveBeenCalledWith('slug-1', 'post_event');
    expect(registrations.submitPostEvent).toHaveBeenCalledWith(
      'slug-1',
      'a@b.com',
      { Nota: '10' },
      [{ label: 'Nota', required: true }],
    );
  });
});
