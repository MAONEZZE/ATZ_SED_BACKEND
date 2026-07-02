import { PrismaRegistrationRepository } from '../../../app/database/registrations/prisma-registration.repository';
import { Prisma } from '@prisma/client';

function makeRepo() {
  const row = {
    id: 'reg-1',
    eventId: 'evt-1',
    status: 'pending',
    answers: { Nome: 'João', 'E-mail': 'joao@test.com', Telefone: '11999' },
    name: 'João',
    email: 'joao@test.com',
    phone: '11999',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
  const prisma = {
    registration: {
      update: jest.fn().mockResolvedValue(row),
    },
  };
  return { repo: new PrismaRegistrationRepository(prisma as any), prisma, row };
}

describe('PrismaRegistrationRepository.updateAnswers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls prisma.registration.update with answers JSON and all three fixed columns', async () => {
    const { repo, prisma } = makeRepo();
    const answers = { Nome: 'Maria', 'E-mail': 'maria@test.com', Telefone: '11888' };

    await repo.updateAnswers('reg-1', {
      answers,
      name: 'Maria',
      email: 'maria@test.com',
      phone: '11888',
    });

    expect(prisma.registration.update).toHaveBeenCalledWith({
      where: { id: 'reg-1' },
      data: {
        answers: answers as Prisma.InputJsonValue,
        name: 'Maria',
        email: 'maria@test.com',
        phone: '11888',
      },
    });
  });

  it('omits name/email/phone keys when they are not present in data', async () => {
    const { repo, prisma } = makeRepo();
    const answers = { Cidade: 'SP' };

    await repo.updateAnswers('reg-1', { answers });

    expect(prisma.registration.update).toHaveBeenCalledWith({
      where: { id: 'reg-1' },
      data: { answers: answers as Prisma.InputJsonValue },
    });
  });

  it('returns mapped RegistrationEntity', async () => {
    const { repo } = makeRepo();
    const result = await repo.updateAnswers('reg-1', { answers: {} });
    expect(result.id).toBe('reg-1');
    expect(result.eventId).toBe('evt-1');
  });
});
