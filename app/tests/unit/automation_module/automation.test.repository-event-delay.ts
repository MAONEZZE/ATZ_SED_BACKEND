import { Test } from '@nestjs/testing';
import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaAutomationRepository } from '@infra/repositories/automation_module/prisma-automation.repository';

async function makeRepo(automationRule: Record<string, jest.Mock>) {
  const prismaMock = { automationRule } as unknown as PrismaService;
  const moduleRef = await Test.createTestingModule({
    providers: [PrismaAutomationRepository, { provide: PrismaService, useValue: prismaMock }],
  }).compile();
  return { repo: moduleRef.get(PrismaAutomationRepository) };
}

const NOW = new Date('2027-03-10T12:00:00Z');
const FIRE_AT = new Date('2027-03-10T20:00:00Z');

function ruleRow(over: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    eventId: 'evt-1',
    templateId: 'tpl-1',
    trigger: 'on_event_delay',
    delayMinutes: null,
    cron: null,
    timezone: null,
    active: true,
    folderId: null,
    order: 0,
    createdAt: new Date('2027-01-01T00:00:00Z'),
    sendAt: null,
    firedAt: null,
    sendTime: null,
    name: null,
    delayDirection: 'before',
    delayValue: 2,
    delayUnit: 'hours',
    firedForAt: FIRE_AT,
    forms: [],
    template: { id: 'tpl-1', name: 'T', channel: 'email' },
    ...over,
  };
}

beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
afterEach(() => jest.useRealTimers());

describe('PrismaAutomationRepository — persistência do delay', () => {
  it('create grava os campos do delay', async () => {
    const create = jest.fn().mockResolvedValue(ruleRow());
    const { repo } = await makeRepo({ create });

    await repo.create({
      eventId: 'evt-1',
      templateId: 'tpl-1',
      trigger: 'on_event_delay',
      delayDirection: 'before',
      delayValue: 2,
      delayUnit: 'hours',
    });

    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({ delayDirection: 'before', delayValue: 2, delayUnit: 'hours' });
  });

  it('create grava null nos campos do delay quando ausentes', async () => {
    const create = jest.fn().mockResolvedValue(ruleRow());
    const { repo } = await makeRepo({ create });

    await repo.create({ eventId: 'evt-1', templateId: 'tpl-1', trigger: 'on_approval' });

    expect(create.mock.calls[0][0].data).toMatchObject({
      delayDirection: null,
      delayValue: null,
      delayUnit: null,
    });
  });

  it('mapeia os 4 campos para a entidade', async () => {
    const create = jest.fn().mockResolvedValue(ruleRow());
    const { repo } = await makeRepo({ create });

    const rule = await repo.create({
      eventId: 'evt-1',
      templateId: 'tpl-1',
      trigger: 'on_event_delay',
    });

    expect(rule).toMatchObject({
      delayDirection: 'before',
      delayValue: 2,
      delayUnit: 'hours',
      firedForAt: FIRE_AT,
    });
  });

  it('update só escreve os campos presentes', async () => {
    const update = jest.fn().mockResolvedValue(ruleRow());
    const { repo } = await makeRepo({ update });

    await repo.update('r1', { delayValue: 5, firedForAt: null });

    const data = update.mock.calls[0][0].data;
    expect(data).toMatchObject({ delayValue: 5, firedForAt: null });
    expect(data).not.toHaveProperty('delayDirection');
    expect(data).not.toHaveProperty('delayUnit');
  });
});

describe('PrismaAutomationRepository.findActiveByEventTriggerAndTemplate — chave do delay', () => {
  it('inclui direção, valor e unidade no where', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const { repo } = await makeRepo({ findFirst });

    await repo.findActiveByEventTriggerAndTemplate(
      'evt-1',
      'on_event_delay',
      'tpl-1',
      undefined,
      undefined,
      { direction: 'before', value: 2, unit: 'hours' },
    );

    expect(findFirst.mock.calls[0][0].where).toMatchObject({
      delayDirection: 'before',
      delayValue: 2,
      delayUnit: 'hours',
    });
  });

  it('sem delay o where não filtra por esses campos', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const { repo } = await makeRepo({ findFirst });

    await repo.findActiveByEventTriggerAndTemplate('evt-1', 'on_approval', 'tpl-1');

    const where = findFirst.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('delayDirection');
    expect(where).not.toHaveProperty('delayValue');
    expect(where).not.toHaveProperty('delayUnit');
  });
});

describe('PrismaAutomationRepository.findEventDelayCandidates', () => {
  it('pré-filtra por gatilho, ativo, status do evento e janela de 367 dias', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { repo } = await makeRepo({ findMany });

    await repo.findEventDelayCandidates();

    expect(findMany).toHaveBeenCalledWith({
      where: {
        trigger: 'on_event_delay',
        active: true,
        event: {
          status: { in: ['published', 'ended'] },
          eventDate: { gte: new Date(NOW.getTime() - 367 * 24 * 60 * 60_000) },
        },
      },
      select: {
        id: true,
        eventId: true,
        delayDirection: true,
        delayValue: true,
        delayUnit: true,
        firedForAt: true,
        forms: { select: { formId: true } },
        event: { select: { eventDate: true, endDate: true } },
      },
    });
  });

  it('mapeia a linha para o candidato', async () => {
    const eventDate = new Date('2027-03-10T22:00:00Z');
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'r1',
        eventId: 'evt-1',
        delayDirection: 'before',
        delayValue: 2,
        delayUnit: 'hours',
        firedForAt: FIRE_AT,
        forms: [{ formId: 'f1' }],
        event: { eventDate, endDate: null },
      },
    ]);
    const { repo } = await makeRepo({ findMany });

    expect(await repo.findEventDelayCandidates()).toEqual([
      {
        id: 'r1',
        eventId: 'evt-1',
        formIds: ['f1'],
        delay: { direction: 'before', value: 2, unit: 'hours' },
        firedForAt: FIRE_AT,
        event: { eventDate, endDate: null },
      },
    ]);
  });
});

describe('PrismaAutomationRepository.markEventDelayRuleFired', () => {
  it('grava firedAt (agora) e firedForAt (o momento processado)', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const { repo } = await makeRepo({ update });

    await repo.markEventDelayRuleFired('r1', FIRE_AT);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { firedAt: NOW, firedForAt: FIRE_AT },
    });
  });
});
