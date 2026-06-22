import { RegistrationsService } from '../../app/services/registrations/registrations.service';
import { BadRequestException } from '@nestjs/common';

function make(eventStatus = 'published') {
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
    }),
  };
  const emitter = { emit: jest.fn() };
  const userSubscriptions = { upsertFromForm: jest.fn().mockResolvedValue({}) };
  const pipedrive = { send: jest.fn() };
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

  it('sends to Pipedrive when sendToPipedrive is true', async () => {
    const { svc, pipedrive } = make();
    const answers = { nome: 'João', email: 'joao@b.com', telefone: '11999990000' };

    await svc.createPublic('slug-1', answers, true);

    expect(pipedrive.send).toHaveBeenCalledWith({
      event: { id: 'evt-1', slug: 'slug-1', title: 'Evento' },
      form: 'registration',
      contact: { name: 'João', email: 'joao@b.com', phone: '11999990000' },
      answers,
    });
  });

  it('does not send to Pipedrive by default', async () => {
    const { svc, pipedrive } = make();
    await svc.createPublic('slug-1', { nome: 'X' });
    expect(pipedrive.send).not.toHaveBeenCalled();
  });

  it('rejects when the event is not published', async () => {
    const { svc } = make('draft');
    await expect(svc.createPublic('slug-1', { nome: 'X' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
