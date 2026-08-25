import { AutomationService } from '@application/automation_module/automation.service';
import { AutomationRuleEntity } from '@domain/automation_module/automation-rule.entity';

function existingFormFieldRule(
  overrides: Partial<{ sendTime: string | null; timezone: string | null; trigger: string }> = {},
) {
  return new AutomationRuleEntity(
    'rule-1',
    'evt-1',
    'tpl-1',
    (overrides.trigger ?? 'on_date_form_field') as any,
    [],
    null,
    null,
    overrides.timezone !== undefined ? overrides.timezone : 'America/Sao_Paulo',
    true,
    null,
    0,
    new Date('2026-01-01'),
    null,
    null,
    overrides.sendTime !== undefined ? overrides.sendTime : '09:00',
    null,
  );
}

function make() {
  const repo = {
    templateById: jest.fn().mockResolvedValue({ id: 'tpl-1' }),
    findActiveByEventTriggerAndTemplate: jest.fn().mockResolvedValue(null),
    findByEvent: jest.fn(),
    create: jest
      .fn()
      .mockImplementation((data: Record<string, unknown>) =>
        Promise.resolve({ id: 'rule-1', ...data }),
      ),
    update: jest
      .fn()
      .mockImplementation((id: string, data: Record<string, unknown>) =>
        Promise.resolve({ id, ...data }),
      ),
  };
  const scheduler = { upsert: jest.fn(), remove: jest.fn().mockResolvedValue(undefined) };
  const forms = {
    findByIdAndEvent: jest
      .fn()
      .mockResolvedValue({ id: 'form-1', name: 'Inscrição', anonymous: false }),
  };
  const folders = { findById: jest.fn().mockResolvedValue(null) };
  const formFields = {
    findByFormAndType: jest
      .fn()
      .mockResolvedValue({ id: 'field-1', formId: 'form-1', label: 'Dia' }),
  };
  const svc = new AutomationService(
    repo as any,
    scheduler as any,
    forms as any,
    folders as any,
    formFields as any,
  );
  return { svc, repo, scheduler, forms, formFields };
}

describe('AutomationService — on_date_form_field trigger', () => {
  beforeEach(() => jest.clearAllMocks());

  // Obrigatório desde que on_date_form_field passou a exigir formIds.
  it('create sem formIds dá 400', async () => {
    const { svc } = make();
    await expect(
      svc.create('evt-1', { templateId: 'tpl-1', trigger: 'on_date_form_field' }),
    ).rejects.toThrow('formIds é obrigatório');
  });

  it('create sem sendAt não dá 400 (on_date_form_field não usa sendAt)', async () => {
    const { svc } = make();
    await expect(
      svc.create('evt-1', {
        templateId: 'tpl-1',
        trigger: 'on_date_form_field',
        formIds: ['form-1'],
      }),
    ).resolves.toBeDefined();
  });

  it('400 quando o formulário escopado não tem campo de data', async () => {
    const { svc, formFields } = make();
    formFields.findByFormAndType.mockResolvedValueOnce(null);

    await expect(
      svc.create('evt-1', {
        templateId: 'tpl-1',
        trigger: 'on_date_form_field',
        formIds: ['form-1'],
      }),
    ).rejects.toThrow('campo de data');
  });

  it('aplica defaults 09:00 + APP_TIMEZONE quando ausentes', async () => {
    const { svc, repo } = make();
    await svc.create('evt-1', {
      templateId: 'tpl-1',
      trigger: 'on_date_form_field',
      formIds: ['form-1'],
    });

    const [data] = repo.create.mock.calls[0] as [{ sendTime: string; timezone: string }];
    expect(data.sendTime).toBe('09:00');
    expect(data.timezone).toBe('America/Sao_Paulo');
  });

  it('preserva sendTime explícito', async () => {
    const { svc, repo } = make();
    await svc.create('evt-1', {
      templateId: 'tpl-1',
      trigger: 'on_date_form_field',
      formIds: ['form-1'],
      sendTime: '18:30',
    });

    const [data] = repo.create.mock.calls[0] as [{ sendTime: string }];
    expect(data.sendTime).toBe('18:30');
  });

  // sendAt não entra na chave: duas regras com o mesmo template no mesmo
  // evento colidem, mesmo que sendTime seja diferente (o dedupKey não carrega
  // sendTime nem ruleId).
  it('duplicata não é escopada por data (sendAt sempre undefined nesse gatilho)', async () => {
    const { svc, repo } = make();
    await svc.create('evt-1', {
      templateId: 'tpl-1',
      trigger: 'on_date_form_field',
      formIds: ['form-1'],
    });

    expect(repo.findActiveByEventTriggerAndTemplate).toHaveBeenCalledWith(
      'evt-1',
      'on_date_form_field',
      'tpl-1',
      undefined,
      undefined,
    );
  });

  it('trocar o gatilho para fora de on_date_form_field zera sendTime, mesmo sem o patch mencionar', async () => {
    const { svc, repo } = make();
    repo.findByEvent.mockResolvedValue(existingFormFieldRule());

    await svc.update('evt-1', 'rule-1', { trigger: 'on_approval' });

    const [, data] = repo.update.mock.calls[0] as [string, { sendTime: string | null }];
    expect(data.sendTime).toBeNull();
  });

  it('PATCH {timezone:null} não mata a regra (o sweeper tem defaults defensivos)', async () => {
    const { svc, repo } = make();
    repo.findByEvent.mockResolvedValue(existingFormFieldRule());

    await expect(svc.update('evt-1', 'rule-1', { timezone: null })).resolves.toBeDefined();

    const [, data] = repo.update.mock.calls[0] as [string, { timezone: string | null }];
    expect(data.timezone).toBeNull();
  });

  // Regra legada sem formulário: um PATCH que não toca formIds não pode 400 —
  // decisão explícita, o frontend vincula o formulário depois via PATCH.
  it('PATCH que não menciona formIds passa numa regra legada sem formulário', async () => {
    const { svc, repo } = make();
    repo.findByEvent.mockResolvedValue(existingFormFieldRule());

    await expect(svc.update('evt-1', 'rule-1', { active: false })).resolves.toBeDefined();
  });

  // Já com o corpo mandando formIds explicitamente, a obrigatoriedade volta a valer.
  it('PATCH que manda formIds: [] num on_date_form_field dá 400', async () => {
    const { svc, repo } = make();
    repo.findByEvent.mockResolvedValue(existingFormFieldRule());

    await expect(svc.update('evt-1', 'rule-1', { formIds: [] })).rejects.toThrow(
      'formIds é obrigatório',
    );
  });
});
