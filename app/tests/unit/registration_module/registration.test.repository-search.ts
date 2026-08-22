import { PrismaRegistrationRepository } from '@infra/repositories/registration_module/prisma-registration.repository';

function makeRepo() {
  const prisma = {
    registration: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  return { repo: new PrismaRegistrationRepository(prisma as any), prisma };
}

describe('PrismaRegistrationRepository.findAllByEvent search', () => {
  beforeEach(() => jest.clearAllMocks());

  it('combines status AND case-insensitive search across name/email/phone', async () => {
    const { repo, prisma } = makeRepo();
    await repo.findAllByEvent('evt-1', 'pending', 'joao');
    expect(prisma.registration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          eventId: 'evt-1',
          status: 'pending',
          OR: [
            { name: { contains: 'joao', mode: 'insensitive' } },
            { email: { contains: 'joao', mode: 'insensitive' } },
            { phone: { contains: 'joao', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });

  it('omits OR clause when no search given', async () => {
    const { repo, prisma } = makeRepo();
    await repo.findAllByEvent('evt-1');
    expect(prisma.registration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: 'evt-1' } }),
    );
  });

  // Filtro por formulário de origem: mesmo padrão de status/attended, direto
  // no where (originFormId já é indexado).
  it('filters by originFormId when formId is given', async () => {
    const { repo, prisma } = makeRepo();
    await repo.findAllByEvent('evt-1', undefined, undefined, undefined, 'form-1');
    expect(prisma.registration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: 'evt-1', originFormId: 'form-1' } }),
    );
  });
});

// Join com originForm (1:1 por inscrito) alimenta a coluna "Formulário" da
// listagem geral — sem duplicar quem respondeu N formulários nem esconder
// quem foi importado sem form_response (ao contrário de agregar via form_responses).
describe('PrismaRegistrationRepository.findAllByEvent formName', () => {
  it('maps originForm.name to formName', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'reg-1',
        eventId: 'evt-1',
        status: 'approved',
        answers: {},
        name: 'João',
        email: 'joao@test.com',
        phone: '5511999998888',
        createdAt: new Date('2026-08-17'),
        updatedAt: new Date('2026-08-17'),
        imageAuthorization: false,
        attended: false,
        originFormId: 'form-1',
        originForm: { name: 'Inscrição VIP' },
      },
    ]);
    const prisma = { registration: { findMany } };
    const repo = new PrismaRegistrationRepository(prisma as any);

    const [row] = await repo.findAllByEvent('evt-1');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: { originForm: { select: { name: true } } } }),
    );
    expect(row.formName).toBe('Inscrição VIP');
  });

  it('maps missing originForm to null formName', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'reg-2',
        eventId: 'evt-1',
        status: 'pending',
        answers: {},
        name: 'Maria',
        email: 'maria@test.com',
        phone: '5511999997777',
        createdAt: new Date('2026-08-17'),
        updatedAt: new Date('2026-08-17'),
        imageAuthorization: false,
        attended: false,
        originFormId: null,
        originForm: null,
      },
    ]);
    const prisma = { registration: { findMany } };
    const repo = new PrismaRegistrationRepository(prisma as any);

    const [row] = await repo.findAllByEvent('evt-1');

    expect(row.formName).toBeNull();
  });
});
