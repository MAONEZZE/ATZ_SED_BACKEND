import { Test } from '@nestjs/testing';
import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaFormResponseRepository } from '@infra/repositories/form_response_module/prisma-form-response.repository';
import { FormResponseEntity } from '@domain/form_response_module/form-response.entity';

const ROW = {
  id: 'resp-1',
  formId: 'form-1',
  eventId: 'evt-1',
  registrationId: 'reg-1',
  answers: { Nota: '9' },
  pipedriveStatus: null,
  createdAt: new Date('2026-08-17'),
  updatedAt: new Date('2026-08-17'),
  form: { name: 'NPS' },
  registration: { name: 'João', email: 'joao@test.com', phone: '5511999998888' },
};

async function makeRepo(formResponse: Record<string, jest.Mock> = {}) {
  const prismaMock = { formResponse } as unknown as PrismaService;
  const moduleRef = await Test.createTestingModule({
    providers: [PrismaFormResponseRepository, { provide: PrismaService, useValue: prismaMock }],
  }).compile();
  return { repo: moduleRef.get(PrismaFormResponseRepository), prismaMock };
}

// Boota o DI do Nest (e não `new Repo(mock)`) para provar que o construtor
// herdado do PrismaRepositoryBase injeta o PrismaService.
describe('PrismaFormResponseRepository DI', () => {
  it('injects PrismaService through the inherited base constructor', async () => {
    const { repo, prismaMock } = await makeRepo();
    expect((repo as unknown as { prisma: unknown }).prisma).toBe(prismaMock);
  });
});

describe('PrismaFormResponseRepository.upsert', () => {
  // Uma resposta por (form, inscrito): reenviar sobrescreve em vez de duplicar.
  it('keys the upsert by form + registration', async () => {
    const upsert = jest.fn().mockResolvedValue(ROW);
    const { repo } = await makeRepo({ upsert });

    const result = await repo.upsert({
      formId: 'form-1',
      eventId: 'evt-1',
      registrationId: 'reg-1',
      answers: { Nota: '9' },
    });

    expect(upsert).toHaveBeenCalledWith({
      where: { formId_registrationId: { formId: 'form-1', registrationId: 'reg-1' } },
      create: {
        formId: 'form-1',
        eventId: 'evt-1',
        registrationId: 'reg-1',
        answers: { Nota: '9' },
      },
      update: { answers: { Nota: '9' } },
    });
    expect(result).toBeInstanceOf(FormResponseEntity);
  });
});

describe('PrismaFormResponseRepository listagens', () => {
  it('joins the form name and the registration contact', async () => {
    const findMany = jest.fn().mockResolvedValue([ROW]);
    const { repo } = await makeRepo({ findMany });

    const [row] = await repo.findAllByEvent('evt-1');

    expect(row).toMatchObject({
      formName: 'NPS',
      name: 'João',
      email: 'joao@test.com',
      phone: '5511999998888',
      answers: { Nota: '9' },
    });
  });

  it('filters by form when given', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { repo } = await makeRepo({ findMany });

    await repo.findAllByEvent('evt-1', 'form-1');

    const [{ where }] = findMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(where).toEqual({ eventId: 'evt-1', formId: 'form-1' });
  });

  it('lists every form of the event when no form is given', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { repo } = await makeRepo({ findMany });

    await repo.findAllByEvent('evt-1');

    const [{ where }] = findMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(where).toEqual({ eventId: 'evt-1' });
  });

  it('paginates with the same scope', async () => {
    const findMany = jest.fn().mockResolvedValue([ROW]);
    const count = jest.fn().mockResolvedValue(1);
    const { repo } = await makeRepo({ findMany, count });

    const { data, total } = await repo.findAllByEventPaginated(
      'evt-1',
      { skip: 0, take: 20 },
      'form-1',
    );

    expect(total).toBe(1);
    expect(data).toHaveLength(1);
    expect(count).toHaveBeenCalledWith({ where: { eventId: 'evt-1', formId: 'form-1' } });
  });
});

describe('PrismaFormResponseRepository.setPipedriveStatus', () => {
  it('updates the row by id', async () => {
    const update = jest.fn().mockResolvedValue(ROW);
    const { repo } = await makeRepo({ update });

    await repo.setPipedriveStatus('resp-1', 'sent');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'resp-1' },
      data: { pipedriveStatus: 'sent' },
    });
  });
});
