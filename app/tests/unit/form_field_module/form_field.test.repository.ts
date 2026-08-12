import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaFormFieldRepository } from '@infra/repositories/form_field_module/prisma-form-field.repository';
import { FormFieldEntity } from '@domain/form_field_module/form-field.entity';

const ROW = {
  id: 'ff-1',
  formId: 'form-1',
  label: 'Nome da empresa',
  type: 'text',
  required: true,
  options: null,
  order: 1,
  isFixed: false,
  createdAt: new Date('2026-05-01'),
};

async function makeRepo(formField: Record<string, jest.Mock> = {}, event = {}) {
  const prismaMock = { formField, event } as unknown as PrismaService;
  const moduleRef = await Test.createTestingModule({
    providers: [PrismaFormFieldRepository, { provide: PrismaService, useValue: prismaMock }],
  }).compile();
  return { repo: moduleRef.get(PrismaFormFieldRepository), prismaMock };
}

// Boots Nest DI (not `new Repo(mock)`) to prove the inherited
// PrismaRepositoryBase constructor injects PrismaService.
describe('PrismaFormFieldRepository DI', () => {
  it('injects PrismaService through the inherited base constructor', async () => {
    const { repo, prismaMock } = await makeRepo();
    expect((repo as unknown as { prisma: unknown }).prisma).toBe(prismaMock);
  });
});

describe('PrismaFormFieldRepository mapping', () => {
  it('returns FormFieldEntity instances from the paginated list', async () => {
    const { repo } = await makeRepo({
      findMany: jest.fn().mockResolvedValue([ROW]),
      count: jest.fn().mockResolvedValue(1),
    });

    const { data } = await repo.findAllByEventPaginated('evt-1', undefined, { skip: 0, take: 20 });

    expect(data[0]).toBeInstanceOf(FormFieldEntity);
    expect(data[0].isOptionsBased()).toBe(false);
  });

  // findByEvent resolves through the parent form's event so a known field id
  // cannot be reached from another event.
  it('scopes findByEvent through the parent event', async () => {
    const findFirst = jest.fn().mockResolvedValue(ROW);
    const { repo } = await makeRepo({ findFirst });

    await repo.findByEvent('evt-1', 'ff-1');

    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'ff-1', form: { eventId: 'evt-1' } } });
  });

  it('recognises an options-based field', async () => {
    const { repo } = await makeRepo({
      findFirst: jest.fn().mockResolvedValue({ ...ROW, type: 'multiselect', options: ['a'] }),
    });

    const field = await repo.findByEvent('evt-1', 'ff-1');

    expect(field!.isOptionsBased()).toBe(true);
  });
});

describe('PrismaFormFieldRepository.listLabels', () => {
  it('lists every label by default', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { repo } = await makeRepo({ findMany });

    await repo.listLabels('evt-1', 'registration');

    const [args] = findMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(args).toMatchObject({
      where: { form: { eventId: 'evt-1', kind: 'registration' } },
      orderBy: { order: 'asc' },
    });
    expect(args.where).not.toHaveProperty('isFixed');
  });

  // CSV headers only cover the dynamic fields; name/e-mail/phone are columns of
  // their own.
  it('excludes fixed fields when asked for dynamic ones only', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { repo } = await makeRepo({ findMany });

    await repo.listLabels('evt-1', 'registration', true);

    const [args] = findMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(args.where).toMatchObject({ isFixed: false });
  });
});

describe('PrismaFormFieldRepository.update', () => {
  it('forwards only the keys present on the input', async () => {
    const update = jest.fn().mockResolvedValue(ROW);
    const { repo } = await makeRepo({ update });

    await repo.update('ff-1', { label: 'Novo rótulo' });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'ff-1' },
      data: { label: 'Novo rótulo' },
    });
  });

  // A field losing its option list is `options: null`, which becomes JSON null
  // rather than being dropped from the payload.
  it('writes Prisma.JsonNull when options are cleared', async () => {
    const update = jest.fn().mockResolvedValue(ROW);
    const { repo } = await makeRepo({ update });

    await repo.update('ff-1', { options: null });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'ff-1' },
      data: { options: Prisma.JsonNull },
    });
  });

  // `required: false` must survive a partial patch.
  it('forwards a false required instead of dropping it', async () => {
    const update = jest.fn().mockResolvedValue(ROW);
    const { repo } = await makeRepo({ update });

    await repo.update('ff-1', { required: false });

    expect(update).toHaveBeenCalledWith({ where: { id: 'ff-1' }, data: { required: false } });
  });
});
