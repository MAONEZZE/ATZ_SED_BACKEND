import { Test } from '@nestjs/testing';
import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaFormRepository } from '@infra/repositories/form_module/prisma-form.repository';

const DATE = new Date('2026-09-24T12:00:00Z');

const ROW = {
  id: 'form-1',
  eventId: 'evt-1',
  name: 'Inscrição',
  slug: 'inscricao',
  order: 0,
  description: null,
  postRegistrationMessage: 'Obrigado!',
  linkPostSubscription: 'https://example.com/antigo',
  requireImageAuthorization: false,
  sendToPipedrive: false,
  anonymous: false,
  createdAt: DATE,
  updatedAt: DATE,
};

async function makeRepo() {
  const form = {
    update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...ROW, ...data })),
  };
  const prismaMock = { form } as unknown as PrismaService;
  const moduleRef = await Test.createTestingModule({
    providers: [PrismaFormRepository, { provide: PrismaService, useValue: prismaMock }],
  }).compile();
  const sentData = () => (form.update.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data;
  return { repo: moduleRef.get(PrismaFormRepository), form, sentData };
}

describe('PrismaFormRepository.update post-submit fields', () => {
  it('persists a new link', async () => {
    const { repo, form } = await makeRepo();

    const updated = await repo.update('form-1', {
      linkPostSubscription: 'https://example.com/novo',
    });

    expect(form.update).toHaveBeenCalledWith({
      where: { id: 'form-1' },
      data: { linkPostSubscription: 'https://example.com/novo' },
    });
    expect(updated.linkPostSubscription).toBe('https://example.com/novo');
  });

  it('persists null to clear link and message', async () => {
    const { repo, sentData } = await makeRepo();

    const updated = await repo.update('form-1', {
      linkPostSubscription: null,
      postRegistrationMessage: null,
    });

    expect(sentData()).toEqual({
      linkPostSubscription: null,
      postRegistrationMessage: null,
    });
    expect(updated.linkPostSubscription).toBeNull();
    expect(updated.postRegistrationMessage).toBeNull();
  });

  it('leaves omitted fields untouched', async () => {
    const { repo, sentData } = await makeRepo();

    await repo.update('form-1', { name: 'Inscrição v2' });

    const data = sentData();
    expect(data).not.toHaveProperty('linkPostSubscription');
    expect(data).not.toHaveProperty('postRegistrationMessage');
  });
});
