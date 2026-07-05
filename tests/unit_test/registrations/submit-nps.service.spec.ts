import { RegistrationsService } from '@modules/registrations/registrations.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

function make(eventStatus = 'ended', reg: any = null) {
  const regRepo = {
    findByEventAndContact: jest.fn().mockResolvedValue(reg),
    upsertPostEventResponse: jest.fn().mockResolvedValue(undefined),
  };
  const eventsService = {
    findBySlug: jest.fn().mockResolvedValue({ id: 'evt-1', status: eventStatus, ownerId: 'o1' }),
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
  return { svc, regRepo, emitter, userSubscriptions };
}

const FIELDS = [{ label: 'Nota', required: true }];

describe('RegistrationsService.submitNps', () => {
  beforeEach(() => jest.clearAllMocks());

  it('consolidates NPS answers and fires on_nps trigger', async () => {
    const { svc, regRepo, userSubscriptions, emitter } = make('ended', {
      id: 'r1',
      name: 'João',
      email: 'a@b.com',
      phone: '11999',
    });
    await svc.submitNps('slug-1', 'a@b.com', { Nota: '9' }, FIELDS);

    // NPS never writes PostEventResponse storage.
    expect(regRepo.upsertPostEventResponse).not.toHaveBeenCalled();
    expect(userSubscriptions.upsertFromForm).toHaveBeenCalledWith(
      'evt-1',
      'nps',
      { Nota: '9' },
      { name: 'João', email: 'a@b.com', phone: '11999' },
    );
    expect(emitter.emit).toHaveBeenCalledWith(
      'form.submitted',
      expect.objectContaining({ trigger: 'on_nps' }),
    );
  });

  it('404 when identifier does not match any registration', async () => {
    const { svc, userSubscriptions } = make('ended', null);
    await expect(svc.submitNps('slug-1', 'a@b.com', { Nota: '9' }, FIELDS)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(userSubscriptions.upsertFromForm).not.toHaveBeenCalled();
  });

  it('enriches contact from a matched registration', async () => {
    const { svc, userSubscriptions } = make('ended', {
      id: 'r1',
      name: 'João',
      email: 'joao@b.com',
      phone: '11999',
    });
    await svc.submitNps('slug-1', 'a@b.com', { Nota: '9' }, FIELDS);
    expect(userSubscriptions.upsertFromForm).toHaveBeenCalledWith('evt-1', 'nps', { Nota: '9' }, {
      name: 'João',
      email: 'joao@b.com',
      phone: '11999',
    });
  });

  it('400 when a required field is missing', async () => {
    const { svc } = make();
    await expect(svc.submitNps('slug-1', 'a@b.com', {}, FIELDS)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
