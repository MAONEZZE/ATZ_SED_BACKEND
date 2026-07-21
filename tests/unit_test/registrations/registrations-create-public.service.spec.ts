import { RegistrationsService } from '@modules/registrations/registrations.service';
import { BadRequestException } from '@nestjs/common';

function make(eventStatus = 'published', eventSendToPipedrive = false, requireImageAuthorization = false) {
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
  const profileRepo = {
    findById: jest.fn().mockResolvedValue({ id: 'o1', requireImageAuthorization }),
  };
  const svc = new RegistrationsService(
    regRepo as any,
    eventsService as any,
    emitter as any,
    userSubscriptions as any,
    pipedrive as any,
    profileRepo as any,
  );
  return { svc, regRepo, emitter, userSubscriptions, pipedrive, profileRepo };
}

describe('RegistrationsService.createPublic', () => {
  beforeEach(() => jest.clearAllMocks());

  it('persists answers, emits on_registration and consolidates into user_subscriptions', async () => {
    const { svc, regRepo, emitter, userSubscriptions } = make();
    const answers = { nome: 'João', email: 'joao@b.com', telefone: '11999990000' };

    await svc.createPublic('slug-1', answers, []);

    expect(regRepo.create).toHaveBeenCalledWith({
      eventId: 'evt-1',
      answers,
      name: 'João',
      email: 'joao@b.com',
      phone: '11999990000',
      imageAuthorization: false,
    });
    expect(emitter.emit).toHaveBeenCalledWith('registration.status_changed', expect.anything());
    expect(userSubscriptions.upsertFromForm).toHaveBeenCalledWith('evt-1', 'registration', answers);
  });

  it('sends to Pipedrive and records pending then sent status', async () => {
    const { svc, pipedrive, userSubscriptions } = make();
    const answers = { nome: 'João', email: 'joao@b.com', telefone: '11999990000' };

    await svc.createPublic('slug-1', answers, [], true);

    expect(pipedrive.send).toHaveBeenCalledWith({
      event: { id: 'evt-1', slug: 'slug-1', title: 'Evento' },
      form: 'registration',
      contact: { email: 'joao@b.com', phone: '11999990000' },
      answers,
    });
    expect(userSubscriptions.markPipedrive).toHaveBeenCalledWith('us-1', true, 'pending');

    // Flush the fire-and-forget webhook + status update.
    await new Promise((r) => setImmediate(r));
    expect(userSubscriptions.markPipedrive).toHaveBeenCalledWith('us-1', true, 'sent');
  });

  it('enriches the Pipedrive contact with linkedin/instagram from typed fields', async () => {
    const { svc, pipedrive } = make();
    const answers = {
      nome: 'João',
      email: 'joao@b.com',
      telefone: '11999990000',
      'Perfil do LinkedIn': 'https://linkedin.com/in/joao',
      'Perfil do Instagram': '@joao',
    };
    const fields = [
      { label: 'Perfil do LinkedIn', type: 'linkedin', required: false },
      { label: 'Perfil do Instagram', type: 'instagram', required: false },
    ];

    await svc.createPublic('slug-1', answers, fields, true);

    expect(pipedrive.send).toHaveBeenCalledWith({
      event: { id: 'evt-1', slug: 'slug-1', title: 'Evento' },
      form: 'registration',
      contact: {
        email: 'joao@b.com',
        phone: '11999990000',
        linkedin: 'https://linkedin.com/in/joao',
        instagram: '@joao',
      },
      answers,
    });
  });

  it('picks phone/email for Pipedrive from the typed fields, not the fixed answer keys', async () => {
    const { svc, pipedrive } = make();
    const answers = {
      nome: 'João',
      'qual o seu e-mail?': 'joao@b.com',
      'qual o seu telefone?': '11999990000',
    };
    const fields = [
      { label: 'qual o seu e-mail?', type: 'email', required: true },
      { label: 'qual o seu telefone?', type: 'phone', required: true },
    ];

    await svc.createPublic('slug-1', answers, fields, true);

    expect(pipedrive.send).toHaveBeenCalledWith({
      event: { id: 'evt-1', slug: 'slug-1', title: 'Evento' },
      form: 'registration',
      contact: { email: 'joao@b.com', phone: '11999990000' },
      answers,
    });
  });

  it('records failed status when the webhook rejects', async () => {
    const { svc, pipedrive, userSubscriptions } = make();
    pipedrive.send.mockRejectedValueOnce(new Error('boom'));

    await svc.createPublic('slug-1', { email: 'a@b.com' }, [], true);
    await new Promise((r) => setImmediate(r));

    expect(userSubscriptions.markPipedrive).toHaveBeenCalledWith('us-1', true, 'failed');
  });

  it('records skipped status and does not send by default', async () => {
    const { svc, pipedrive, userSubscriptions } = make();
    await svc.createPublic('slug-1', { nome: 'X' }, []);
    expect(pipedrive.send).not.toHaveBeenCalled();
    expect(userSubscriptions.markPipedrive).toHaveBeenCalledWith('us-1', false, 'skipped');
  });

  it('falls back to the event-level sendToPipedrive when the body omits the flag', async () => {
    const { svc, pipedrive } = make('published', true);
    await svc.createPublic('slug-1', { email: 'a@b.com' }, []);
    expect(pipedrive.send).toHaveBeenCalled();
  });

  it('body flag false overrides an event-level true', async () => {
    const { svc, pipedrive, userSubscriptions } = make('published', true);
    await svc.createPublic('slug-1', { email: 'a@b.com' }, [], false);
    expect(pipedrive.send).not.toHaveBeenCalled();
    expect(userSubscriptions.markPipedrive).toHaveBeenCalledWith('us-1', false, 'skipped');
  });

  it('extracts name/email/phone case-insensitively when the answer keys differ from the fixed lookup keys', async () => {
    const { svc, regRepo } = make();
    const answers = { NOME: 'João', Email: 'joao@b.com', Telefone: '11999990000' };

    await svc.createPublic('slug-1', answers, []);

    expect(regRepo.create).toHaveBeenCalledWith({
      eventId: 'evt-1',
      answers,
      name: 'João',
      email: 'joao@b.com',
      phone: '11999990000',
      imageAuthorization: false,
    });
  });

  it('rejects when the event is not published', async () => {
    const { svc } = make('draft');
    await expect(svc.createPublic('slug-1', { nome: 'X' }, [])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  describe('image authorization', () => {
    it('rejects when owner requires it and the flag is omitted', async () => {
      const { svc } = make('published', false, true);
      await expect(svc.createPublic('slug-1', { nome: 'X' }, [])).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects when owner requires it and the flag is false', async () => {
      const { svc } = make('published', false, true);
      await expect(
        svc.createPublic('slug-1', { nome: 'X' }, [], undefined, false),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts and persists true when owner requires it and the flag is true', async () => {
      const { svc, regRepo } = make('published', false, true);
      await svc.createPublic('slug-1', { nome: 'X' }, [], undefined, true);
      expect(regRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ imageAuthorization: true }),
      );
    });

    it('accepts and persists false when the owner does not require it', async () => {
      const { svc, regRepo } = make('published', false, false);
      await svc.createPublic('slug-1', { nome: 'X' }, []);
      expect(regRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ imageAuthorization: false }),
      );
    });
  });
});
