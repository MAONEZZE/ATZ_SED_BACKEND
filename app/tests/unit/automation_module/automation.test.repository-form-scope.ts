import { Test } from '@nestjs/testing';
import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaAutomationRepository } from '@infra/repositories/automation_module/prisma-automation.repository';

const RULE_ROW = {
  id: 'rule-1',
  eventId: 'evt-1',
  templateId: 'tpl-1',
  trigger: 'on_form_submitted',
  delayMinutes: null,
  cron: null,
  timezone: null,
  active: true,
  folderId: null,
  order: 0,
  createdAt: new Date('2026-08-17'),
  template: { id: 'tpl-1', name: 'Boas-vindas', channel: 'whatsapp' },
  forms: [{ formId: 'form-1' }],
};

async function makeRepo(automationRule: Record<string, jest.Mock> = {}) {
  const prismaMock = { automationRule } as unknown as PrismaService;
  const moduleRef = await Test.createTestingModule({
    providers: [PrismaAutomationRepository, { provide: PrismaService, useValue: prismaMock }],
  }).compile();
  return { repo: moduleRef.get(PrismaAutomationRepository) };
}

// Junção automation_rule_forms (N formulários por regra): create/update gravam
// via nested write na relação `forms`, e a entidade lê de volta um array.
describe('PrismaAutomationRepository create/update — formIds via join table', () => {
  it('nests a create per formId when creating with forms', async () => {
    const create = jest.fn().mockResolvedValue(RULE_ROW);
    const { repo } = await makeRepo({ create });

    await repo.create({
      eventId: 'evt-1',
      templateId: 'tpl-1',
      trigger: 'on_form_submitted',
      formIds: ['form-1', 'form-2'],
    });

    expect(create.mock.calls[0][0].data.forms).toEqual({
      create: [{ formId: 'form-1' }, { formId: 'form-2' }],
    });
  });

  it('omits the forms relation entirely when no form is given', async () => {
    const create = jest.fn().mockResolvedValue({ ...RULE_ROW, forms: [] });
    const { repo } = await makeRepo({ create });

    await repo.create({ eventId: 'evt-1', templateId: 'tpl-1', trigger: 'on_approval' });

    expect(create.mock.calls[0][0].data).not.toHaveProperty('forms');
  });

  it('maps the persisted forms back onto the entity as formIds', async () => {
    const { repo } = await makeRepo({ create: jest.fn().mockResolvedValue(RULE_ROW) });

    const rule = await repo.create({
      eventId: 'evt-1',
      templateId: 'tpl-1',
      trigger: 'on_form_submitted',
      formIds: ['form-1'],
    });

    expect(rule.formIds).toEqual(['form-1']);
  });

  it('replaces the whole join (delete + recreate) when updating formIds', async () => {
    const update = jest.fn().mockResolvedValue({ ...RULE_ROW, forms: [{ formId: 'form-2' }] });
    const { repo } = await makeRepo({ update });

    await repo.update('rule-1', { formIds: ['form-2'] });

    expect(update.mock.calls[0][0].data.forms).toEqual({
      deleteMany: {},
      create: [{ formId: 'form-2' }],
    });
  });

  it('clears the join with an explicit empty array (deleteMany, no create)', async () => {
    const update = jest.fn().mockResolvedValue({ ...RULE_ROW, forms: [] });
    const { repo } = await makeRepo({ update });

    await repo.update('rule-1', { formIds: [] });

    expect(update.mock.calls[0][0].data.forms).toEqual({ deleteMany: {}, create: [] });
  });

  it('leaves the join alone when formIds is absent', async () => {
    const update = jest.fn().mockResolvedValue(RULE_ROW);
    const { repo } = await makeRepo({ update });

    await repo.update('rule-1', { active: false });

    expect(update.mock.calls[0][0].data).not.toHaveProperty('forms');
  });
});

describe('PrismaAutomationRepository.createManyForDuplication', () => {
  // createMany não aceita nested writes; cada regra precisa do próprio create
  // pra gravar a junção de formIds junto — por isso um create por regra, numa
  // transação, em vez de um único createMany.
  it('creates one rule per item, nesting the resolved formIds, inside a transaction', async () => {
    const create = jest.fn((args: unknown) => args);
    const $transaction = jest.fn((ops: unknown[]) => Promise.resolve(ops));
    const { repo } = await makeRepo({ create });
    (repo as unknown as { prisma: { $transaction: unknown } }).prisma.$transaction = $transaction;

    await repo.createManyForDuplication('evt-new', [
      {
        templateId: 'tpl-1',
        trigger: 'on_form_submitted',
        delayMinutes: null,
        cron: null,
        timezone: null,
        sendAt: null,
        sendTime: null,
        name: null,
        active: true,
        order: 0,
        formIds: ['form-new-1'],
      },
    ]);

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: 'evt-new',
        templateId: 'tpl-1',
        forms: { create: [{ formId: 'form-new-1' }] },
      }),
    });
  });
});
