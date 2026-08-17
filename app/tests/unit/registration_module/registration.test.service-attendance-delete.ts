import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RegistrationService } from '@application/registration_module/registration.service';
import { RegistrationEntity } from '@domain/registration_module/registration.entity';

const DATE = new Date('2026-08-14T12:00:00Z');

const reg = new RegistrationEntity(
  'reg-1',
  'evt-1',
  'approved',
  {},
  'João',
  'joao@test.com',
  '+5511999998888',
  DATE,
  DATE,
);

function makeService(overrides?: { registration?: RegistrationEntity | null; status?: string }) {
  const regRepo = {
    findById: jest
      .fn()
      .mockResolvedValue(overrides && 'registration' in overrides ? overrides.registration : reg),
    findByEventAndContact: jest
      .fn()
      .mockResolvedValue(overrides && 'registration' in overrides ? overrides.registration : reg),
    deleteMany: jest.fn().mockResolvedValue(2),
    setAttendance: jest.fn().mockResolvedValue(1),
  };
  const eventsService = {
    findBySlug: jest.fn().mockResolvedValue({ id: 'evt-1', status: overrides?.status ?? 'published' }),
    findById: jest.fn().mockResolvedValue({ id: 'evt-1', ownerId: 'user-1' }),
  };
  const service = new RegistrationService(
    regRepo as any,
    eventsService as any,
    { emit: jest.fn() } as any,
    { upsertFromForm: jest.fn(), markPipedrive: jest.fn() } as any,
    { send: jest.fn() } as any,
    { getOrCreate: jest.fn() } as any,
  );
  return { service, regRepo, eventsService };
}

describe('RegistrationService.delete', () => {
  it('checks the registration belongs to the event before deleting', async () => {
    const { service, regRepo } = makeService({ registration: null });

    await expect(service.delete('reg-1', 'evt-1')).rejects.toThrow(NotFoundException);
    expect(regRepo.deleteMany).not.toHaveBeenCalled();
  });

  // O eventId vai junto no where: um id de outro evento não pode ser apagado
  // por quem tem acesso a este.
  it('scopes the delete to the event', async () => {
    const { service, regRepo } = makeService();

    await service.delete('reg-1', 'evt-1');

    expect(regRepo.deleteMany).toHaveBeenCalledWith(['reg-1'], 'evt-1');
  });
});

describe('RegistrationService.deleteMany', () => {
  it('returns how many rows were deleted', async () => {
    const { service } = makeService();

    await expect(service.deleteMany(['a', 'b'], 'evt-1')).resolves.toBe(2);
  });

  it('rejects an empty list', async () => {
    const { service, regRepo } = makeService();

    await expect(service.deleteMany([], 'evt-1')).rejects.toThrow(BadRequestException);
    expect(regRepo.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects more than 500 ids in one request', async () => {
    const { service, regRepo } = makeService();
    const ids = Array.from({ length: 501 }, (_, i) => `reg-${i}`);

    await expect(service.deleteMany(ids, 'evt-1')).rejects.toThrow(BadRequestException);
    expect(regRepo.deleteMany).not.toHaveBeenCalled();
  });
});

describe('RegistrationService.setAttendance', () => {
  it('marks the given ids within the event', async () => {
    const { service, regRepo } = makeService();

    await service.setAttendance(['reg-1'], 'evt-1', true);

    expect(regRepo.setAttendance).toHaveBeenCalledWith(['reg-1'], 'evt-1', true);
  });

  it('unmarks with attended=false', async () => {
    const { service, regRepo } = makeService();

    await service.setAttendance(['reg-1'], 'evt-1', false);

    expect(regRepo.setAttendance).toHaveBeenCalledWith(['reg-1'], 'evt-1', false);
  });

  it('applies the same batch ceiling as the delete', async () => {
    const { service } = makeService();
    const ids = Array.from({ length: 501 }, (_, i) => `reg-${i}`);

    await expect(service.setAttendance(ids, 'evt-1', true)).rejects.toThrow(BadRequestException);
  });
});

describe('RegistrationService.checkIn', () => {
  it('matches the registration by normalised phone and marks attendance', async () => {
    const { service, regRepo } = makeService();

    await service.checkIn('tech-day', '(11) 99999-8888');

    expect(regRepo.findByEventAndContact).toHaveBeenCalledWith('evt-1', {
      phone: '5511999998888',
    });
    expect(regRepo.setAttendance).toHaveBeenCalledWith(['reg-1'], 'evt-1', true);
  });

  // Quem não se inscreveu não entra na lista pelo check-in.
  it('rejects a phone with no registration', async () => {
    const { service, regRepo } = makeService({ registration: null });

    await expect(service.checkIn('tech-day', '11999998888')).rejects.toThrow(NotFoundException);
    expect(regRepo.setAttendance).not.toHaveBeenCalled();
  });

  it('accepts check-in on an event that already ended', async () => {
    const { service, regRepo } = makeService({ status: 'ended' });

    await service.checkIn('tech-day', '11999998888');

    expect(regRepo.setAttendance).toHaveBeenCalled();
  });

  it('rejects check-in on a draft event', async () => {
    const { service, regRepo } = makeService({ status: 'draft' });

    await expect(service.checkIn('tech-day', '11999998888')).rejects.toThrow(BadRequestException);
    expect(regRepo.setAttendance).not.toHaveBeenCalled();
  });

  it('rejects an empty phone', async () => {
    const { service } = makeService();

    await expect(service.checkIn('tech-day', '   ')).rejects.toThrow(BadRequestException);
  });
});
