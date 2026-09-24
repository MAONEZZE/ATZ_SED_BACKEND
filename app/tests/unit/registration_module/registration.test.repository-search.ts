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

  // Quem respondeu o formulário já sendo inscrito (FormResponse) também é do
  // formulário — não só quem foi criado por ele (originFormId, que cobre o import).
  it('filters by origin form OR form response when formId is given', async () => {
    const { repo, prisma } = makeRepo();
    await repo.findAllByEvent('evt-1', undefined, undefined, undefined, 'form-1');
    expect(prisma.registration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          eventId: 'evt-1',
          AND: [
            {
              OR: [{ originFormId: 'form-1' }, { formResponses: { some: { formId: 'form-1' } } }],
            },
          ],
        },
      }),
    );
  });

  it('keeps the search OR alongside the form filter', async () => {
    const { repo, prisma } = makeRepo();
    await repo.findAllByEvent('evt-1', undefined, 'joao', undefined, 'form-1');
    const where = prisma.registration.findMany.mock.calls[0][0].where;
    expect(where.OR).toHaveLength(3);
    expect(where.AND).toHaveLength(1);
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

// Sem dedup entre formulários: a busca por contato só enxerga inscritos do
// formulário (criados por ele ou que já o responderam), nunca do evento todo.
describe('PrismaRegistrationRepository.findByEventAndContact form scope', () => {
  const formScope = {
    AND: [
      {
        OR: [{ originFormId: 'form-2' }, { formResponses: { some: { formId: 'form-2' } } }],
      },
    ],
  };

  it('ignores a registration with the same phone that belongs to another form', async () => {
    const { repo, prisma } = makeRepo();
    await repo.findByEventAndContact('evt-1', 'form-2', { phone: '11999998888' });

    expect(prisma.registration.findMany).toHaveBeenCalledWith({
      where: { eventId: 'evt-1', ...formScope },
    });
  });

  it('scopes the email lookup to the form too', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const repo = new PrismaRegistrationRepository({ registration: { findFirst } } as any);
    await repo.findByEventAndContact('evt-1', 'form-2', { email: 'a@x.com' });

    expect(findFirst).toHaveBeenCalledWith({
      where: { eventId: 'evt-1', ...formScope, email: { equals: 'a@x.com', mode: 'insensitive' } },
    });
  });
});
