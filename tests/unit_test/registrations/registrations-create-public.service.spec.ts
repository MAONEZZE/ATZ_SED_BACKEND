import { RegistrationsService } from '../../../app/services/registrations/registrations.service';
import { BadRequestException } from '@nestjs/common';

function make(eventStatus = 'published', eventSendToPipedrive = false) {
  const regRepo = {
    create: jest.fn().mockResolvedValue({ id: 'reg-1', eventId: 'evt-1' }),
  };
  const eventsService = {
    findBySlug: jest.fn().mockResolvedValue({
      id: 'evt-1',
      slug: 'slug-1',
      title: 'Evento',
      status: eventStatus,
      ownerId: 'o1',
      sendToPipedrive: eventSendToPipedrive,
    }),
  };
  const emitter = { emit: jest.fn() };
  const userSubscriptions = {
    upsertFromForm: jest.fn().mockResolvedValue({ id: 'us-1' }),
    markPipedrive: jest.fn().mockResolvedValue(undefined),
  };
  const pipedrive = { send: jest.fn().mockResolvedValue(undefined) };
  const svc = new RegistrationsService(
    regRepo as any,
    eventsService as any,
    emitter as any,
    userSubscriptions as any,
    pipedrive as any,
  );
  return { svc, regRepo, emitter, userSubscriptions, pipedrive };
}

describe('RegistrationsService.createPublic', () => {
  beforeEach(() => jest.clearAllMocks());

  it('persists answers, emits on_registration and consolidates into user_subscriptions', async () => {
    const { svc, regRepo, emitter, userSubscriptions } = make();
    const answers = { nome: 'João', email: 'joao@b.com', telefone: '11999990000' };

    await svc.createPublic('slug-1', answers);

    expect(regRepo.create).toHaveBeenCalledWith({
      eventId: 'evt-1',
      answers,
      name: 'João',
      email: 'joao@b.com',
      phone: '11999990000',
    });
    expect(emitter.emit).toHaveBeenCalledWith('registration.status_changed', expect.anything());
    expect(userSubscriptions.upsertFromForm).toHaveBeenCalledWith('evt-1', 'registration', answers);
  });

  it('sends to Pipedrive and records pending then sent status', async () => {
    const { svc, pipedrive, userSubscriptions } = make();
    const answers = { nome: 'João', email: 'joao@b.com', telefone: '11999990000' };

    await svc.createPublic('slug-1', answers, true);

    expect(pipedrive.send).toHaveBeenCalledWith({
      event: { id: 'evt-1', slug: 'slug-1', title: 'Evento' },
      form: 'registration',
      contact: { name: 'João', email: 'joao@b.com', phone: '11999990000' },
      answers,
    });
    expect(userSubscriptions.markPipedrive).toHaveBeenCalledWith('us-1', true, 'pending');

    // Flush the fire-and-forget webhook + status update.
    await new Promise((r) => setImmediate(r));
    expect(userSubscriptions.markPipedrive).toHaveBeenCalledWith('us-1', true, 'sent');
  });

  it('records failed status when the webhook rejects', async () => {
    const { svc, pipedrive, userSubscriptions } = make();
    pipedrive.send.mockRejectedValueOnce(new Error('boom'));

    await svc.createPublic('slug-1', { email: 'a@b.com' }, true);
    await new Promise((r) => setImmediate(r));

    expect(userSubscriptions.markPipedrive).toHaveBeenCalledWith('us-1', true, 'failed');
  });

  it('records skipped status and does not send by default', async () => {
    const { svc, pipedrive, userSubscriptions } = make();
    await svc.createPublic('slug-1', { nome: 'X' });
    expect(pipedrive.send).not.toHaveBeenCalled();
    expect(userSubscriptions.markPipedrive).toHaveBeenCalledWith('us-1', false, 'skipped');
  });

  it('falls back to the event-level sendToPipedrive when the body omits the flag', async () => {
    const { svc, pipedrive } = make('published', true);
    await svc.createPublic('slug-1', { email: 'a@b.com' });
    expect(pipedrive.send).toHaveBeenCalled();
  });

  it('body flag false overrides an event-level true', async () => {
    const { svc, pipedrive, userSubscriptions } = make('published', true);
    await svc.createPublic('slug-1', { email: 'a@b.com' }, false);
    expect(pipedrive.send).not.toHaveBeenCalled();
    expect(userSubscriptions.markPipedrive).toHaveBeenCalledWith('us-1', false, 'skipped');
  });

  it('rejects when the event is not published', async () => {
    const { svc } = make('draft');
    await expect(svc.createPublic('slug-1', { nome: 'X' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
