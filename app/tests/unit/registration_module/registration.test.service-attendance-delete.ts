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

/**
 * Candidata do check-in: inscrição + data do evento, medida em dias a partir de
 * agora (0 = hoje, -30 = há um mês).
 */
function candidate(id: string, eventId: string, phone: string, dayOffset: number) {
  const eventDate = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
  return { id, phone, eventId, eventTitle: `Evento ${eventId}`, eventSlug: eventId, eventDate };
}

const DEFAULT_CANDIDATES = [
  candidate('reg-antigo', 'evt-antigo', '11999998888', -30),
  candidate('reg-hoje', 'evt-hoje', '(11) 99999-8888', 0),
];

function makeService(overrides?: {
  registration?: RegistrationEntity | null;
  status?: string;
  candidates?: ReturnType<typeof candidate>[];
}) {
  const regRepo = {
    // O check-in relê a inscrição escolhida, então o mock precisa devolver uma
    // entidade do mesmo evento da candidata — senão o findById acusa 404.
    findById: jest.fn().mockImplementation((id: string) => {
      if (overrides && 'registration' in overrides) return Promise.resolve(overrides.registration);
      const found = (overrides?.candidates ?? DEFAULT_CANDIDATES).find((c) => c.id === id);
      if (!found) return Promise.resolve(reg);
      return Promise.resolve(
        new RegistrationEntity(
          found.id,
          found.eventId,
          'approved',
          {},
          'João',
          'joao@test.com',
          found.phone,
          DATE,
          DATE,
          false,
          true,
        ),
      );
    }),
    findByEventAndContact: jest
      .fn()
      .mockResolvedValue(overrides && 'registration' in overrides ? overrides.registration : reg),
    findByPhoneWithEventDate: jest
      .fn()
      .mockResolvedValue(overrides?.candidates ?? DEFAULT_CANDIDATES),
    deleteMany: jest.fn().mockResolvedValue(2),
    setAttendance: jest.fn().mockResolvedValue(1),
  };
  const eventsService = {
    findBySlug: jest
      .fn()
      .mockResolvedValue({ id: 'evt-1', status: overrides?.status ?? 'published' }),
    findById: jest.fn().mockResolvedValue({ id: 'evt-1', ownerId: 'user-1' }),
  };
  const service = new RegistrationService(
    regRepo as any,
    eventsService as any,
    { emit: jest.fn() } as any,
    { send: jest.fn() } as any,
    { findOne: jest.fn(), primary: jest.fn(), findPublic: jest.fn() } as any,
    { upsert: jest.fn() } as any,
    { listValidationFields: jest.fn().mockResolvedValue([]) } as any,
    { materialize: jest.fn().mockImplementation((a) => Promise.resolve(a)) } as any,
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
  // A pessoa digita o telefone como quiser; o evento sai da data, não da URL.
  it('marks attendance on the registration whose event date is closest to today', async () => {
    const { service, regRepo } = makeService();

    const result = await service.checkIn('(11) 99999-8888');

    expect(regRepo.findByPhoneWithEventDate).toHaveBeenCalledWith('99998888');
    expect(regRepo.setAttendance).toHaveBeenCalledWith(['reg-hoje'], 'evt-hoje', true);
    expect(result.event.id).toBe('evt-hoje');
  });

  // O SQL corta pelos 8 dígitos finais: sem conferir o DDD, marcaria presença
  // pela pessoa errada.
  it('discards a candidate with the same last 8 digits but another area code', async () => {
    const { service, regRepo } = makeService({
      candidates: [candidate('reg-outro-ddd', 'evt-outro', '(21) 99999-8888', 0)],
    });

    await expect(service.checkIn('11999998888')).rejects.toThrow(NotFoundException);
    expect(regRepo.setAttendance).not.toHaveBeenCalled();
  });

  // Número gravado sem o nono dígito (e sem 55) é a mesma pessoa.
  it('matches a stored phone without the ninth digit', async () => {
    const { service, regRepo } = makeService({
      candidates: [candidate('reg-antigo', 'evt-antigo', '1199998888', 0)],
    });

    await service.checkIn('5511999998888');

    expect(regRepo.setAttendance).toHaveBeenCalledWith(['reg-antigo'], 'evt-antigo', true);
  });

  it('prefers an event today over one that already happened', async () => {
    const { service, regRepo } = makeService({
      candidates: [
        candidate('reg-antigo', 'evt-antigo', '11999998888', -30),
        candidate('reg-hoje', 'evt-hoje', '11999998888', 0),
      ],
    });

    await service.checkIn('11999998888');

    expect(regRepo.setAttendance).toHaveBeenCalledWith(['reg-hoje'], 'evt-hoje', true);
  });

  // Quem não se inscreveu não entra na lista pelo check-in.
  it('rejects a phone with no registration', async () => {
    const { service, regRepo } = makeService({ candidates: [] });

    await expect(service.checkIn('11999998888')).rejects.toThrow(NotFoundException);
    expect(regRepo.setAttendance).not.toHaveBeenCalled();
  });

  it('rejects a phone without enough digits', async () => {
    const { service, regRepo } = makeService();

    await expect(service.checkIn('   ')).rejects.toThrow(BadRequestException);
    await expect(service.checkIn('99998888')).rejects.toThrow(BadRequestException);
    expect(regRepo.findByPhoneWithEventDate).not.toHaveBeenCalled();
  });
});
