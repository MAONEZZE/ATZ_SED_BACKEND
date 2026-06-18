import { RegistrationsService } from '../../app/services/registrations/registrations.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

function make(eventStatus = 'ended', reg: any = { id: 'r1', eventId: 'evt-1' }) {
  const regRepo = {
    findByEventAndContact: jest.fn().mockResolvedValue(reg),
    upsertPostEventResponse: jest.fn().mockResolvedValue(undefined),
  };
  const eventsService = {
    findBySlug: jest.fn().mockResolvedValue({ id: 'evt-1', status: eventStatus, ownerId: 'o1' }),
  };
  const emitter = { emit: jest.fn() };
  const svc = new RegistrationsService(regRepo as any, eventsService as any, emitter as any);
  return { svc, regRepo, eventsService };
}

const FIELDS = [{ label: 'Nota', type: 'text', required: true, isFixed: false }];

describe('RegistrationsService.submitPostEvent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('treats identifier with @ as email', async () => {
    const { svc, regRepo } = make();
    await svc.submitPostEvent('slug-1', 'a@b.com', { Nota: '10' }, FIELDS);
    expect(regRepo.findByEventAndContact).toHaveBeenCalledWith('evt-1', { email: 'a@b.com' });
  });

  it('treats identifier without @ as phone (digits only)', async () => {
    const { svc, regRepo } = make();
    await svc.submitPostEvent('slug-1', '(55) 11 99999-0000', { Nota: '10' }, FIELDS);
    expect(regRepo.findByEventAndContact).toHaveBeenCalledWith('evt-1', { phone: '5511999990000' });
  });

  it('trims and lowercases an email identifier', async () => {
    const { svc, regRepo } = make();
    await svc.submitPostEvent('slug-1', '  A@B.com  ', { Nota: '10' }, FIELDS);
    expect(regRepo.findByEventAndContact).toHaveBeenCalledWith('evt-1', { email: 'a@b.com' });
  });

  it('trims a phone identifier and strips it to digits only', async () => {
    const { svc, regRepo } = make();
    await svc.submitPostEvent('slug-1', '  (55) 11 99999-0000  ', { Nota: '10' }, FIELDS);
    expect(regRepo.findByEventAndContact).toHaveBeenCalledWith('evt-1', { phone: '5511999990000' });
  });

  it('upserts the response when registration is found', async () => {
    const { svc, regRepo } = make();
    await svc.submitPostEvent('slug-1', 'a@b.com', { Nota: '10' }, FIELDS);
    expect(regRepo.upsertPostEventResponse).toHaveBeenCalledWith({
      eventId: 'evt-1',
      registrationId: 'r1',
      answers: { Nota: '10' },
    });
  });

  it('rejects event not published/ended', async () => {
    const { svc } = make('draft');
    await expect(
      svc.submitPostEvent('slug-1', 'a@b.com', { Nota: '10' }, FIELDS),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404 when no matching registration', async () => {
    const { svc } = make('ended', null);
    await expect(
      svc.submitPostEvent('slug-1', 'a@b.com', { Nota: '10' }, FIELDS),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404 when identifier resolves to empty contact', async () => {
    const { svc, regRepo } = make();
    await expect(
      svc.submitPostEvent('slug-1', 'abc', { Nota: '10' }, FIELDS),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(regRepo.findByEventAndContact).not.toHaveBeenCalled();
  });

  it('400 when a required post-event field is missing', async () => {
    const { svc } = make();
    await expect(svc.submitPostEvent('slug-1', 'a@b.com', {}, FIELDS)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
