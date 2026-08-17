import { Test } from '@nestjs/testing';
import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaAutomationRepository } from '@infra/repositories/automation_module/prisma-automation.repository';
import { AutomationRuleEntity } from '@domain/automation_module/automation-rule.entity';
import { MessageTemplateEntity } from '@domain/message_template_module/message-template.entity';

const RULE_ROW = {
  id: 'rule-1',
  eventId: 'evt-1',
  templateId: 'tpl-1',
  trigger: 'on_registration',
  delayMinutes: null,
  cron: null,
  timezone: null,
  active: true,
  createdAt: new Date('2026-06-01'),
};

const TEMPLATE_ROW = {
  id: 'tpl-1',
  ownerId: 'owner-1',
  name: 'Boas-vindas',
  channel: 'whatsapp',
  subject: null,
  body: 'Olá {{nome}}',
  layoutConfig: null,
  styleKey: null,
  eventId: null,
  createdAt: new Date('2026-06-01'),
  updatedAt: new Date('2026-06-01'),
};

async function makeRepo(automationRule: Record<string, jest.Mock> = {}, messageTemplate = {}) {
  const prismaMock = { automationRule, messageTemplate } as unknown as PrismaService;
  const moduleRef = await Test.createTestingModule({
    providers: [PrismaAutomationRepository, { provide: PrismaService, useValue: prismaMock }],
  }).compile();
  return { repo: moduleRef.get(PrismaAutomationRepository), prismaMock };
}

// Boots Nest DI (not `new Repo(mock)`) to prove the inherited
// PrismaRepositoryBase constructor injects PrismaService. See profile.repository
// spec for the underlying design:paramtypes gotcha.
describe('PrismaAutomationRepository DI', () => {
  it('injects PrismaService through the inherited base constructor', async () => {
    const { repo, prismaMock } = await makeRepo();
    expect((repo as unknown as { prisma: unknown }).prisma).toBe(prismaMock);
  });
});

describe('PrismaAutomationRepository mapping', () => {
  it('returns an AutomationRuleEntity from findById', async () => {
    const { repo } = await makeRepo({ findUnique: jest.fn().mockResolvedValue(RULE_ROW) });

    const rule = await repo.findById('rule-1');

    expect(rule).toBeInstanceOf(AutomationRuleEntity);
    expect(rule!.isRecurring()).toBe(false);
    // delayMinutes null means "send right away".
    expect(rule!.isImmediate()).toBe(true);
  });

  it('treats delayMinutes 0 as immediate, like null', async () => {
    const { repo } = await makeRepo({
      findUnique: jest.fn().mockResolvedValue({ ...RULE_ROW, delayMinutes: 0 }),
    });

    const rule = await repo.findById('rule-1');

    expect(rule!.isImmediate()).toBe(true);
  });

  it('recognises a recurring rule', async () => {
    const { repo } = await makeRepo({
      findUnique: jest.fn().mockResolvedValue({ ...RULE_ROW, trigger: 'recurring' }),
    });

    const rule = await repo.findById('rule-1');

    expect(rule!.isRecurring()).toBe(true);
  });

  // The listings serialise straight into the HTTP body, so the template summary
  // is attached to the entity rather than wrapping it.
  it('attaches the template summary and keeps the serialised shape', async () => {
    const { repo } = await makeRepo({
      findMany: jest
        .fn()
        .mockResolvedValue([
          { ...RULE_ROW, template: { id: 'tpl-1', name: 'Boas-vindas', channel: 'whatsapp' } },
        ]),
      count: jest.fn().mockResolvedValue(1),
    });

    const { data } = await repo.findAllByEventPaginated('evt-1', { skip: 0, take: 20 });

    expect(data[0]).toBeInstanceOf(AutomationRuleEntity);
    expect(JSON.parse(JSON.stringify(data[0]))).toMatchObject({
      id: 'rule-1',
      trigger: 'on_registration',
      template: { id: 'tpl-1', name: 'Boas-vindas', channel: 'whatsapp' },
    });
  });

  // The engine renders the message, so it needs the whole template, not a summary.
  it('maps the full template entity on findOneWithTemplate', async () => {
    const { repo } = await makeRepo({
      findFirst: jest.fn().mockResolvedValue({ ...RULE_ROW, template: TEMPLATE_ROW }),
    });

    const rule = await repo.findOneWithTemplate('evt-1', 'rule-1');

    expect(rule!.template).toBeInstanceOf(MessageTemplateEntity);
    expect(rule!.template.body).toBe('Olá {{nome}}');
  });
});

describe('PrismaAutomationRepository.findActiveTriggerRules', () => {
  // Without an explicit id set, only rules with no wait are due right now;
  // rules stored with 0 mean the same as null.
  it('restricts to immediate rules when no ruleIds are given', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { repo } = await makeRepo({ findMany });

    await repo.findActiveTriggerRules('evt-1', 'on_registration');

    const [args] = findMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(args.where).toMatchObject({
      eventId: 'evt-1',
      trigger: 'on_registration',
      active: true,
      OR: [{ delayMinutes: null }, { delayMinutes: 0 }],
    });
  });

  it('filters by the exact rule set when ruleIds are given', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { repo } = await makeRepo({ findMany });

    await repo.findActiveTriggerRules('evt-1', 'recurring', ['r1', 'r2']);

    const [args] = findMany.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(args.where).toMatchObject({ id: { in: ['r1', 'r2'] } });
    expect(args.where).not.toHaveProperty('OR');
  });
});

describe('PrismaAutomationRepository.update', () => {
  it('forwards only the keys present on the input', async () => {
    const update = jest.fn().mockResolvedValue({
      ...RULE_ROW,
      template: { id: 'tpl-1', name: 'X', channel: 'whatsapp' },
    });
    const { repo } = await makeRepo({ update });

    await repo.update('rule-1', { active: false });

    const [args] = update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(args.data).toEqual({ active: false });
  });

  // Clearing a delay is an explicit null and must survive a partial patch.
  it('forwards an explicit null delayMinutes', async () => {
    const update = jest.fn().mockResolvedValue({
      ...RULE_ROW,
      template: { id: 'tpl-1', name: 'X', channel: 'whatsapp' },
    });
    const { repo } = await makeRepo({ update });

    await repo.update('rule-1', { delayMinutes: null });

    const [args] = update.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(args.data).toEqual({ delayMinutes: null });
  });
});

describe('PrismaAutomationRepository.findActiveByEventTriggerAndTemplate', () => {
  // A duplicata barrada é (evento + gatilho + template + formulário) ativa. O
  // templateId no where é o que libera e-mail + WhatsApp no mesmo gatilho; o
  // formId é o que libera o mesmo template em formulários diferentes.
  it('filters by event, trigger, template, form and active', async () => {
    const findFirst = jest.fn().mockResolvedValue(RULE_ROW);
    const { repo } = await makeRepo({ findFirst });

    const found = await repo.findActiveByEventTriggerAndTemplate(
      'evt-1',
      'on_approval',
      'tpl-1',
      null,
    );

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        eventId: 'evt-1',
        trigger: 'on_approval',
        templateId: 'tpl-1',
        formId: null,
        active: true,
      },
    });
    expect(found).toBeInstanceOf(AutomationRuleEntity);
  });

  it('scopes the lookup to the form when the rule has one', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const { repo } = await makeRepo({ findFirst });

    await repo.findActiveByEventTriggerAndTemplate(
      'evt-1',
      'on_form_submitted',
      'tpl-1',
      'form-2',
    );

    const [{ where }] = findFirst.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(where.formId).toBe('form-2');
  });

  it('excludes the rule being edited', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const { repo } = await makeRepo({ findFirst });

    await repo.findActiveByEventTriggerAndTemplate(
      'evt-1',
      'on_approval',
      'tpl-1',
      null,
      'rule-1',
    );

    const [{ where }] = findFirst.mock.calls[0] as [{ where: Record<string, unknown> }];
    expect(where.id).toEqual({ not: 'rule-1' });
  });
});

describe('PrismaAutomationRepository.templateById scope', () => {
  // Antes o id era aceito sozinho: template de outro evento entrava na regra.
  it('accepts only the event template or a global one when the event is given', async () => {
    const findFirst = jest.fn().mockResolvedValue(TEMPLATE_ROW);
    const { repo } = await makeRepo({}, { findFirst });

    const template = await repo.templateById('tpl-1', 'evt-1');

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'tpl-1', OR: [{ eventId: 'evt-1' }, { eventId: null }] },
    });
    expect(template).toBeInstanceOf(MessageTemplateEntity);
  });

  it('keeps the plain lookup when no event is given', async () => {
    const findFirst = jest.fn().mockResolvedValue(TEMPLATE_ROW);
    const { repo } = await makeRepo({}, { findFirst });

    await repo.templateById('tpl-1');

    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'tpl-1' } });
  });
});
