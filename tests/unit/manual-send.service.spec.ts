import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ManualSendService } from '@services/messaging/manual-send.service';
import { TemplateRenderer } from '@services/automations/template-renderer.service';

const event = {
  id: 'evt-1',
  ownerId: 'user-1',
  title: 'Tech Day',
  eventDate: new Date('2026-06-15T18:00:00'),
  location: 'SP',
  capacity: 100,
  dressCode: null,
  groupLink: null,
  evolutionInstance: 'inst-1',
};

const regJoao = {
  id: 'reg-1',
  eventId: 'evt-1',
  name: 'João',
  email: 'joao@test.com',
  phone: '+5511999999999',
};

const template = {
  id: 'tmpl-1',
  eventId: 'evt-1',
  channel: 'email',
  subject: 'Oi {{nome}}',
  body: 'Olá {{nome}}, bem-vindo ao {{evento}}!',
};

// min=max torna o jitter determinístico para asserção
const pacing: Record<string, number> = {
  WA_MIN_DELAY_MS: 1000,
  WA_MAX_DELAY_MS: 1000,
};

function makeService(overrides?: { registrations?: unknown[]; template?: unknown }) {
  const prisma = {
    registration: {
      findMany: jest.fn().mockResolvedValue(overrides?.registrations ?? [regJoao]),
    },
    messageTemplate: {
      findFirst: jest
        .fn()
        .mockResolvedValue(overrides && 'template' in overrides ? overrides.template : template),
    },
  };
  const eventsService = { findById: jest.fn().mockResolvedValue(event) };
  const outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn((key: string) => pacing[key]) };
  const service = new ManualSendService(
    prisma as any,
    eventsService as any,
    outbox as any,
    new TemplateRenderer(),
    config as any,
  );
  return { service, prisma, eventsService, outbox };
}

describe('ManualSendService.send', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws BadRequest when no recipients at all', async () => {
    const { service } = makeService({ registrations: [] });
    await expect(
      service.send({ eventId: 'evt-1', channel: 'email', body: 'oi' }, 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFound when templateId does not exist for event', async () => {
    const { service } = makeService({ template: null });
    await expect(
      service.send(
        {
          eventId: 'evt-1',
          channel: 'email',
          templateId: 'tmpl-x',
          registrationIds: ['reg-1'],
        },
        'user-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequest when template channel mismatches request channel', async () => {
    const { service } = makeService({
      template: { ...template, channel: 'whatsapp' },
    });
    await expect(
      service.send(
        {
          eventId: 'evt-1',
          channel: 'email',
          templateId: 'tmpl-1',
          registrationIds: ['reg-1'],
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequest when neither templateId nor body provided', async () => {
    const { service } = makeService();
    await expect(
      service.send({ eventId: 'evt-1', channel: 'email', registrationIds: ['reg-1'] }, 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('renders template variables and enqueues per recipient', async () => {
    const { service, outbox } = makeService();
    const result = await service.send(
      {
        eventId: 'evt-1',
        channel: 'email',
        templateId: 'tmpl-1',
        registrationIds: ['reg-1'],
      },
      'user-1',
    );
    expect(result.queued).toBe(1);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        registrationId: 'reg-1',
        templateId: 'tmpl-1',
        trigger: 'manual',
        channel: 'email',
        recipient: 'joao@test.com',
        renderedBody: 'Olá João, bem-vindo ao Tech Day!',
        renderedSubject: 'Oi João',
        dedupKey: expect.stringMatching(/^manual:evt-1:joao@test\.com:[0-9a-f]+$/),
      }),
      expect.any(Object),
    );
  });

  it('request body overrides template body', async () => {
    const { service, outbox } = makeService();
    await service.send(
      {
        eventId: 'evt-1',
        channel: 'email',
        templateId: 'tmpl-1',
        body: 'Custom para {{nome}}',
        registrationIds: ['reg-1'],
      },
      'user-1',
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ renderedBody: 'Custom para João' }),
      expect.any(Object),
    );
  });

  it('skips recipients without email on email channel', async () => {
    const { service, outbox } = makeService({
      registrations: [regJoao, { ...regJoao, id: 'reg-2', name: 'Sem', email: '' }],
    });
    const result = await service.send(
      {
        eventId: 'evt-1',
        channel: 'email',
        body: 'oi',
        registrationIds: ['reg-1', 'reg-2'],
      },
      'user-1',
    );
    expect(result.queued).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.skippedReason.length).toBeGreaterThan(0);
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });

  it('skips manual recipients without phone on whatsapp channel', async () => {
    const { service, outbox } = makeService({ registrations: [] });
    const result = await service.send(
      {
        eventId: 'evt-1',
        channel: 'whatsapp',
        body: 'oi',
        manualRecipients: [
          { name: 'Zap', phone: '+5511888888888' },
          { name: 'SemFone', email: 'x@y.com' },
        ],
      },
      'user-1',
    );
    expect(result.queued).toBe(1);
    expect(result.skipped).toBe(1);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: '+5511888888888',
        registrationId: undefined,
        templateId: undefined,
        instancia: 'inst-1',
      }),
      expect.any(Object),
    );
  });

  it('email sends sem delay de pacing (opts.delayMs 0)', async () => {
    const { service, outbox } = makeService();
    await service.send(
      { eventId: 'evt-1', channel: 'email', body: 'oi', registrationIds: ['reg-1'] },
      'user-1',
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'email' }),
      expect.objectContaining({ delayMs: 0 }),
    );
  });

  it('whatsapp acumula delay crescente por destinatário (anti-ban jitter)', async () => {
    const { service, outbox } = makeService({
      registrations: [
        { ...regJoao, id: 'r1', phone: '+5511000000001' },
        { ...regJoao, id: 'r2', phone: '+5511000000002' },
        { ...regJoao, id: 'r3', phone: '+5511000000003' },
      ],
    });
    const result = await service.send(
      {
        eventId: 'evt-1',
        channel: 'whatsapp',
        body: 'oi',
        registrationIds: ['r1', 'r2', 'r3'],
      },
      'user-1',
    );
    expect(result.queued).toBe(3);
    // min=max=1000 → 1000, 2000, 3000
    const delays = outbox.enqueue.mock.calls.map((c: any[]) => c[1]?.delayMs);
    expect(delays).toEqual([1000, 2000, 3000]);
  });

  it('dedups recipients by channel target across registrations and manual', async () => {
    const { service, outbox } = makeService();
    const result = await service.send(
      {
        eventId: 'evt-1',
        channel: 'email',
        body: 'oi',
        registrationIds: ['reg-1'],
        manualRecipients: [{ name: 'Dup', email: 'joao@test.com' }],
      },
      'user-1',
    );
    expect(result.queued).toBe(1);
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });
});
