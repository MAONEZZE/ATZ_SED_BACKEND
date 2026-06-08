import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ManualSendService } from '@services/messaging/manual-send.service';
import { TemplateRenderer } from '@services/automations/template-renderer.service';

const event = {
  id: 'evt-1',
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
  const service = new ManualSendService(
    prisma as any,
    eventsService as any,
    outbox as any,
    new TemplateRenderer(),
  );
  return { service, prisma, eventsService, outbox };
}

describe('ManualSendService.send', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws BadRequest when no recipients at all', async () => {
    const { service } = makeService({ registrations: [] });
    await expect(service.send('evt-1', { channel: 'email', body: 'oi' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws NotFound when templateId does not exist for event', async () => {
    const { service } = makeService({ template: null });
    await expect(
      service.send('evt-1', {
        channel: 'email',
        templateId: 'tmpl-x',
        registrationIds: ['reg-1'],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequest when template channel mismatches request channel', async () => {
    const { service } = makeService({
      template: { ...template, channel: 'whatsapp' },
    });
    await expect(
      service.send('evt-1', {
        channel: 'email',
        templateId: 'tmpl-1',
        registrationIds: ['reg-1'],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequest when neither templateId nor body provided', async () => {
    const { service } = makeService();
    await expect(
      service.send('evt-1', { channel: 'email', registrationIds: ['reg-1'] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('renders template variables and enqueues per recipient', async () => {
    const { service, outbox } = makeService();
    const result = await service.send('evt-1', {
      channel: 'email',
      templateId: 'tmpl-1',
      registrationIds: ['reg-1'],
    });
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
    );
  });

  it('request body overrides template body', async () => {
    const { service, outbox } = makeService();
    await service.send('evt-1', {
      channel: 'email',
      templateId: 'tmpl-1',
      body: 'Custom para {{nome}}',
      registrationIds: ['reg-1'],
    });
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ renderedBody: 'Custom para João' }),
    );
  });

  it('skips recipients without email on email channel', async () => {
    const { service, outbox } = makeService({
      registrations: [regJoao, { ...regJoao, id: 'reg-2', name: 'Sem', email: '' }],
    });
    const result = await service.send('evt-1', {
      channel: 'email',
      body: 'oi',
      registrationIds: ['reg-1', 'reg-2'],
    });
    expect(result.queued).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.skippedReason.length).toBeGreaterThan(0);
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });

  it('skips manual recipients without phone on whatsapp channel', async () => {
    const { service, outbox } = makeService({ registrations: [] });
    const result = await service.send('evt-1', {
      channel: 'whatsapp',
      body: 'oi',
      manualRecipients: [
        { name: 'Zap', phone: '+5511888888888' },
        { name: 'SemFone', email: 'x@y.com' },
      ],
    });
    expect(result.queued).toBe(1);
    expect(result.skipped).toBe(1);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: '+5511888888888',
        registrationId: undefined,
        templateId: undefined,
        instancia: 'inst-1',
      }),
    );
  });

  it('dedups recipients by channel target across registrations and manual', async () => {
    const { service, outbox } = makeService();
    const result = await service.send('evt-1', {
      channel: 'email',
      body: 'oi',
      registrationIds: ['reg-1'],
      manualRecipients: [{ name: 'Dup', email: 'joao@test.com' }],
    });
    expect(result.queued).toBe(1);
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });
});
