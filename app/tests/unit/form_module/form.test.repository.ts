import { Test } from '@nestjs/testing';
import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaFormRepository } from '@infra/repositories/form_module/prisma-form.repository';

async function makeRepo(update = jest.fn().mockResolvedValue({ id: 'form-1' })) {
  const findUnique = jest.fn().mockResolvedValue(null);
  const prismaMock = { form: { findUnique, update } };

  const moduleRef = await Test.createTestingModule({
    providers: [PrismaFormRepository, { provide: PrismaService, useValue: prismaMock }],
  }).compile();

  return { repo: moduleRef.get(PrismaFormRepository), findUnique, update };
}

describe('PrismaFormRepository', () => {
  // Repositories extend PrismaRepositoryBase without declaring their own
  // constructor. Booting Nest DI (not manual `new`) proves the base's
  // PrismaService is actually injected — `new Repo(mock)` would mask a break.
  it('receives PrismaService through the inherited base constructor', async () => {
    const { repo, findUnique } = await makeRepo();

    await expect(repo.findByEventAndKind('evt-1', 'registration')).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledWith({
      where: { eventId_kind: { eventId: 'evt-1', kind: 'registration' } },
    });
  });

  // The port takes an all-optional UpdateFormData; absent keys must not reach
  // Prisma, or a partial PATCH would null out columns the caller never sent.
  // This filtering used to live in FormsService and moved here with the port.
  describe('update', () => {
    it('forwards only the keys present on the input', async () => {
      const { repo, update } = await makeRepo();

      await repo.update('form-1', { postRegistrationMessage: 'Obrigado!' });

      expect(update).toHaveBeenCalledWith({
        where: { id: 'form-1' },
        data: { postRegistrationMessage: 'Obrigado!' },
      });
    });

    it('forwards every key when all are provided', async () => {
      const { repo, update } = await makeRepo();

      await repo.update('form-1', {
        description: 'D',
        postRegistrationMessage: 'M',
        linkPostSubscription: 'https://x.test',
        requireImageAuthorization: true,
      });

      expect(update).toHaveBeenCalledWith({
        where: { id: 'form-1' },
        data: {
          description: 'D',
          postRegistrationMessage: 'M',
          linkPostSubscription: 'https://x.test',
          requireImageAuthorization: true,
        },
      });
    });

    it('sends an empty payload when the input carries no keys', async () => {
      const { repo, update } = await makeRepo();

      await repo.update('form-1', {});

      expect(update).toHaveBeenCalledWith({ where: { id: 'form-1' }, data: {} });
    });

    it('keeps a false requireImageAuthorization instead of dropping it', async () => {
      const { repo, update } = await makeRepo();

      await repo.update('form-1', { requireImageAuthorization: false });

      expect(update).toHaveBeenCalledWith({
        where: { id: 'form-1' },
        data: { requireImageAuthorization: false },
      });
    });
  });
});
