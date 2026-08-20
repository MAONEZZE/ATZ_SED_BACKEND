import { AutomationService } from '@application/automation_module/automation.service';
import { BadRequestException } from '@nestjs/common';
import { AutomationRuleEntity } from '@domain/automation_module/automation-rule.entity';

function existingDateRule(sendAt: Date | null, firedAt: Date | null = null) {
  return new AutomationRuleEntity(
    'rule-1',
    'evt-1',
    'tpl-1',
    'on_date',
    [],
    null,
    null,
    'America/Sao_Paulo',
    true,
    null,
    0,
    new Date('2026-01-01'),
    sendAt,
    firedAt,
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
  const forms = { findByIdAndEvent: jest.fn().mockResolvedValue({ id: 'form-1' }) };
  const folders = { findById: jest.fn().mockResolvedValue(null) };
  const svc = new AutomationService(repo as any, scheduler as any, forms as any, folders as any);
  return { svc, repo, scheduler };
}

describe('AutomationService — on_date trigger', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an on_date rule without sendAt', async () => {
    const { svc } = make();

    await expect(svc.create('evt-1', { templateId: 'tpl-1', trigger: 'on_date' })).rejects.toThrow(
      BadRequestException,
    );
  });

  // A regra nunca dispararia por si; pior, o sweeper a pegaria na varredura
  // seguinte e mandaria a mensagem "atrasada".
  it('rejects a sendAt in the past', async () => {
    const { svc } = make();

    await expect(
      svc.create('evt-1', {
        templateId: 'tpl-1',
        trigger: 'on_date',
        sendAt: '2020-02-12T09:00:00',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // Sem fuso explícito é o fuso da aplicação (America/Sao_Paulo, UTC-3):
  // 09:00 local = 12:00 UTC.
  it('reads sendAt in the app timezone by default and stores UTC', async () => {
    const { svc, repo } = make();

    await svc.create('evt-1', {
      templateId: 'tpl-1',
      trigger: 'on_date',
      sendAt: '2027-02-12T09:00:00',
    });

    const [data] = repo.create.mock.calls[0] as [{ sendAt: Date; timezone: string }];
    expect(data.sendAt.toISOString()).toBe('2027-02-12T12:00:00.000Z');
    expect(data.timezone).toBe('America/Sao_Paulo');
  });

  it('honours an explicit timezone', async () => {
    const { svc, repo } = make();

    await svc.create('evt-1', {
      templateId: 'tpl-1',
      trigger: 'on_date',
      sendAt: '2027-02-12T09:00:00',
      timezone: 'UTC',
    });

    const [data] = repo.create.mock.calls[0] as [{ sendAt: Date; timezone: string }];
    expect(data.sendAt.toISOString()).toBe('2027-02-12T09:00:00.000Z');
    expect(data.timezone).toBe('UTC');
  });

  it('ignores sendAt on triggers that are not on_date', async () => {
    const { svc, repo } = make();

    await svc.create('evt-1', {
      templateId: 'tpl-1',
      trigger: 'on_registration',
      sendAt: '2027-02-12T09:00:00',
    });

    const [data] = repo.create.mock.calls[0] as [{ sendAt: Date | null; timezone: string | null }];
    expect(data.sendAt).toBeNull();
    expect(data.timezone).toBeNull();
  });

  // Sem limpar o fired_at, remarcar a data de uma regra já disparada não
  // dispararia nada na data nova.
  it('clears firedAt when the date changes', async () => {
    const { svc, repo } = make();
    repo.findByEvent.mockResolvedValue(
      existingDateRule(new Date('2027-02-12T12:00:00Z'), new Date('2027-02-12T12:00:05Z')),
    );

    await svc.update('evt-1', 'rule-1', { sendAt: '2027-03-20T09:00:00' });

    const [, data] = repo.update.mock.calls[0] as [string, { sendAt: Date; firedAt: null }];
    expect(data.sendAt.toISOString()).toBe('2027-03-20T12:00:00.000Z');
    expect(data.firedAt).toBeNull();
  });

  it('leaves the stored date alone when the patch does not mention it', async () => {
    const { svc, repo } = make();
    repo.findByEvent.mockResolvedValue(existingDateRule(new Date('2027-02-12T12:00:00Z')));

    await svc.update('evt-1', 'rule-1', { active: false });

    const [, data] = repo.update.mock.calls[0] as [string, Record<string, unknown>];
    expect(data).not.toHaveProperty('sendAt');
    expect(data).not.toHaveProperty('firedAt');
  });
});
