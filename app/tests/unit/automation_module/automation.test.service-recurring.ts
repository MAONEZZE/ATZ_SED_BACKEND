import { AutomationService } from '@application/automation_module/automation.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  AutomationRuleEntity,
  AutomationTrigger,
} from '@domain/automation_module/automation-rule.entity';

// A porta devolve entidades, e o service pergunta isRecurring() a elas.
function rule(overrides: {
  id?: string;
  trigger: AutomationTrigger;
  active?: boolean;
  cron?: string | null;
  timezone?: string | null;
}) {
  return new AutomationRuleEntity(
    overrides.id ?? 'rule-1',
    'evt-1',
    'tpl-1',
    overrides.trigger,
    null,
    null,
    overrides.cron ?? null,
    overrides.timezone ?? null,
    overrides.active ?? true,
    new Date('2026-01-01'),
  );
}

function make() {
  const repo = {
    templateById: jest.fn().mockResolvedValue({ id: 'tpl-1' }),
    findActiveByEventTriggerAndTemplate: jest.fn().mockResolvedValue(null),
    findByEvent: jest.fn(),
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'rule-1', ...data })),
    update: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const scheduler = {
    upsert: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    syncAll: jest.fn().mockResolvedValue(undefined),
  };
  const forms = { findByIdAndEvent: jest.fn().mockResolvedValue({ id: 'form-1' }) };
  const svc = new AutomationService(repo as any, scheduler as any, forms as any);
  return { svc, repo, scheduler, forms };
}

describe('AutomationService — recurring trigger', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects creating a recurring rule without cron', async () => {
    const { svc } = make();
    await expect(
      svc.create('evt-1', {
        templateId: 'tpl-1',
        trigger: 'recurring',
        timezone: 'America/Sao_Paulo',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects creating a recurring rule without timezone', async () => {
    const { svc } = make();
    await expect(
      svc.create('evt-1', { templateId: 'tpl-1', trigger: 'recurring', cron: '0 9 * * 1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a recurring rule and registers the scheduler', async () => {
    const { svc, repo, scheduler } = make();
    const rule = await svc.create('evt-1', {
      templateId: 'tpl-1',
      trigger: 'recurring',
      cron: '0 9 * * 1',
      timezone: 'America/Sao_Paulo',
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ cron: '0 9 * * 1', timezone: 'America/Sao_Paulo' }),
    );
    expect(scheduler.upsert).toHaveBeenCalledWith({
      id: 'rule-1',
      cron: '0 9 * * 1',
      timezone: 'America/Sao_Paulo',
    });
    expect(rule).toMatchObject({ id: 'rule-1' });
  });

  // A duplicata barrada passou a ser (gatilho + template), inclusive no
  // recurring: duas regras com o mesmo template colidiriam no dedupKey.
  it('checks the narrow duplicate when creating a recurring rule', async () => {
    const { svc, repo } = make();
    await svc.create('evt-1', {
      templateId: 'tpl-1',
      trigger: 'recurring',
      cron: '0 9 * * 1',
      timezone: 'America/Sao_Paulo',
    });
    expect(repo.findActiveByEventTriggerAndTemplate).toHaveBeenCalledWith(
      'evt-1',
      'recurring',
      'tpl-1',
      undefined,
    );
  });

  it('checks the duplicate by trigger AND template on immediate triggers', async () => {
    const { svc, repo } = make();
    await svc.create('evt-1', { templateId: 'tpl-1', trigger: 'on_approval' });
    expect(repo.findActiveByEventTriggerAndTemplate).toHaveBeenCalledWith(
      'evt-1',
      'on_approval',
      'tpl-1',
      undefined,
    );
  });

  it('rejects the same template twice on the same trigger', async () => {
    const { svc, repo } = make();
    repo.findActiveByEventTriggerAndTemplate.mockResolvedValue({ id: 'existing' });
    await expect(
      svc.create('evt-1', { templateId: 'tpl-1', trigger: 'on_approval' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  // O caso de uso que motivou a mudança: aprovar dispara e-mail E WhatsApp.
  it('allows a second rule on the same trigger with another template', async () => {
    const { svc, repo } = make();
    await svc.create('evt-1', { templateId: 'tpl-email', trigger: 'on_approval' });
    await svc.create('evt-1', { templateId: 'tpl-whatsapp', trigger: 'on_approval' });
    expect(repo.create).toHaveBeenCalledTimes(2);
  });

  it('does not register a scheduler for an inactive recurring rule', async () => {
    const { svc, scheduler } = make();
    await svc.create('evt-1', {
      templateId: 'tpl-1',
      trigger: 'recurring',
      cron: '0 9 * * 1',
      timezone: 'America/Sao_Paulo',
      active: false,
    });
    expect(scheduler.upsert).not.toHaveBeenCalled();
    expect(scheduler.remove).toHaveBeenCalledWith('rule-1');
  });

  // repo.update (Prisma) always returns the full row, not just the patched
  // fields — mirror that here instead of the generic `make()` mock which
  // only spreads the patch.
  // O repositório devolve a regra já atualizada; o service usa esse retorno para
  // decidir o que fazer com o scheduler.
  function mockFullRowUpdate(
    repo: ReturnType<typeof make>['repo'],
    existing: AutomationRuleEntity,
  ) {
    repo.update.mockImplementation((id: string, data: Record<string, unknown>) =>
      Promise.resolve(
        rule({
          id,
          trigger: (data.trigger as AutomationTrigger) ?? existing.trigger,
          active: (data.active as boolean) ?? existing.active,
          cron: data.cron !== undefined ? (data.cron as string | null) : existing.cron,
          timezone:
            data.timezone !== undefined ? (data.timezone as string | null) : existing.timezone,
        }),
      ),
    );
  }

  it('update: removes the scheduler when deactivating a recurring rule', async () => {
    const { svc, repo, scheduler } = make();
    const existing = rule({
      trigger: 'recurring',
      cron: '0 9 * * 1',
      timezone: 'America/Sao_Paulo',
    });
    repo.findByEvent.mockResolvedValue(existing);
    mockFullRowUpdate(repo, existing);

    await svc.update('evt-1', 'rule-1', { active: false });

    expect(scheduler.remove).toHaveBeenCalledWith('rule-1');
    expect(scheduler.upsert).not.toHaveBeenCalled();
  });

  it('update: re-upserts the scheduler when changing the cron of an active recurring rule', async () => {
    const { svc, repo, scheduler } = make();
    const existing = rule({
      trigger: 'recurring',
      cron: '0 9 * * 1',
      timezone: 'America/Sao_Paulo',
    });
    repo.findByEvent.mockResolvedValue(existing);
    mockFullRowUpdate(repo, existing);

    await svc.update('evt-1', 'rule-1', { cron: '0 10 * * 2' });

    expect(scheduler.upsert).toHaveBeenCalledWith({
      id: 'rule-1',
      cron: '0 10 * * 2',
      timezone: 'America/Sao_Paulo',
    });
  });

  it('update: removes the scheduler when trigger changes away from recurring', async () => {
    const { svc, repo, scheduler } = make();
    const existing = rule({
      trigger: 'recurring',
      cron: '0 9 * * 1',
      timezone: 'America/Sao_Paulo',
    });
    repo.findByEvent.mockResolvedValue(existing);
    mockFullRowUpdate(repo, existing);

    await svc.update('evt-1', 'rule-1', { trigger: 'on_registration' });

    expect(scheduler.remove).toHaveBeenCalledWith('rule-1');
    expect(scheduler.upsert).not.toHaveBeenCalled();
  });

  it('update: throws NotFoundException when the rule does not exist', async () => {
    const { svc, repo } = make();
    repo.findByEvent.mockResolvedValue(null);
    await expect(svc.update('evt-1', 'missing', { active: false })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('delete: removes the scheduler when deleting a recurring rule', async () => {
    const { svc, repo, scheduler } = make();
    repo.findByEvent.mockResolvedValue(rule({ trigger: 'recurring' }));

    await svc.delete('evt-1', 'rule-1');

    expect(repo.delete).toHaveBeenCalledWith('rule-1');
    expect(scheduler.remove).toHaveBeenCalledWith('rule-1');
  });

  it('delete: does not touch the scheduler for a non-recurring rule', async () => {
    const { svc, repo, scheduler } = make();
    repo.findByEvent.mockResolvedValue(rule({ trigger: 'on_registration' }));

    await svc.delete('evt-1', 'rule-1');

    expect(scheduler.remove).not.toHaveBeenCalled();
  });
});

// Gatilho por formulário (2026-08-17): substituiu on_post_event/on_nps.
describe('AutomationService — gatilho on_form_submitted', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects the rule without a formId', async () => {
    const { svc, repo } = make();

    await expect(
      svc.create('evt-1', { templateId: 'tpl-1', trigger: 'on_form_submitted' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('stores the formId when given', async () => {
    const { svc, repo } = make();

    await svc.create('evt-1', {
      templateId: 'tpl-1',
      trigger: 'on_form_submitted',
      formId: 'form-1',
    });

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ formId: 'form-1' }));
  });

  // O formulário do gatilho tem que ser do próprio evento.
  it('404s a form from another event', async () => {
    const { svc, repo, forms } = make();
    forms.findByIdAndEvent.mockResolvedValue(null);

    await expect(
      svc.create('evt-1', { templateId: 'tpl-1', trigger: 'on_form_submitted', formId: 'form-x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  // Nos outros gatilhos o formId não faz sentido e é descartado.
  it('nulls the formId on a trigger that is not form-scoped', async () => {
    const { svc, repo } = make();

    await svc.create('evt-1', {
      templateId: 'tpl-1',
      trigger: 'on_approval',
      formId: 'form-1',
    });

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ formId: null }));
  });
});
