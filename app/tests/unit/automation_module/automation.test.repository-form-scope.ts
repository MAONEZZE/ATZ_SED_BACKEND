import { Test } from '@nestjs/testing';
import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaAutomationRepository } from '@infra/repositories/automation_module/prisma-automation.repository';

const RULE_ROW = {
  id: 'rule-1',
  eventId: 'evt-1',
  templateId: 'tpl-1',
  trigger: 'on_form_submitted',
  formId: 'form-1',
  delayMinutes: null,
  cron: null,
  timezone: null,
  active: true,
  folderId: null,
  order: 0,
  createdAt: new Date('2026-08-17'),
  template: { id: 'tpl-1', name: 'Boas-vindas', channel: 'whatsapp' },
};

async function makeRepo(automationRule: Record<string, jest.Mock> = {}) {
  const prismaMock = { automationRule } as unknown as PrismaService;
  const moduleRef = await Test.createTestingModule({
    providers: [PrismaAutomationRepository, { provide: PrismaService, useValue: prismaMock }],
  }).compile();
  return { repo: moduleRef.get(PrismaAutomationRepository) };
}

// O `formId` era lido (row -> entity) e usado na chave de duplicata, mas nunca
// gravado: a coluna ficava NULL e o escopo por formulário de `on_form_submitted`
// não funcionava. Estes testes travam a persistência.
describe('PrismaAutomationRepository.create formId', () => {
  it('persists the formId', async () => {
    const create = jest.fn().mockResolvedValue(RULE_ROW);
    const { repo } = await makeRepo({ create });

    await repo.create({
      eventId: 'evt-1',
      templateId: 'tpl-1',
      trigger: 'on_form_submitted',
      formId: 'form-1',
    });

    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ formId: 'form-1' }),
    );
  });

  it('writes null when no form is given', async () => {
    const create = jest.fn().mockResolvedValue({ ...RULE_ROW, formId: null });
    const { repo } = await makeRepo({ create });

    await repo.create({ eventId: 'evt-1', templateId: 'tpl-1', trigger: 'on_approval' });

    expect(create.mock.calls[0][0].data).toEqual(expect.objectContaining({ formId: null }));
  });

  it('maps the persisted formId back onto the entity', async () => {
    const { repo } = await makeRepo({ create: jest.fn().mockResolvedValue(RULE_ROW) });

    const rule = await repo.create({
      eventId: 'evt-1',
      templateId: 'tpl-1',
      trigger: 'on_form_submitted',
      formId: 'form-1',
    });

    expect(rule.formId).toBe('form-1');
  });
});

describe('PrismaAutomationRepository.update formId', () => {
  it('persists a new formId', async () => {
    const update = jest.fn().mockResolvedValue({ ...RULE_ROW, formId: 'form-2' });
    const { repo } = await makeRepo({ update });

    await repo.update('rule-1', { formId: 'form-2' });

    expect(update.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ formId: 'form-2' }),
    );
  });

  it('clears the formId with an explicit null', async () => {
    const update = jest.fn().mockResolvedValue({ ...RULE_ROW, formId: null });
    const { repo } = await makeRepo({ update });

    await repo.update('rule-1', { formId: null });

    expect(update.mock.calls[0][0].data).toEqual(expect.objectContaining({ formId: null }));
  });

  it('leaves the column alone when formId is absent', async () => {
    const update = jest.fn().mockResolvedValue(RULE_ROW);
    const { repo } = await makeRepo({ update });

    await repo.update('rule-1', { active: false });

    expect(update.mock.calls[0][0].data).not.toHaveProperty('formId');
  });
});
