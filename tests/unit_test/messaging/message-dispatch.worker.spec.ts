import { MessageDispatchWorker } from '@workers/message-dispatch.worker';

const outboxRow = {
  id: 'msg-1',
  registrationId: 'reg-1',
  templateId: 'tmpl-1',
  trigger: 'on_registration',
  channel: 'email',
  recipient: 'a@b.com',
  instancia: null,
  renderedBody: 'Olá',
  renderedSubject: 'Assunto',
  status: 'pending',
};

function makeMocks(row: unknown) {
  const prisma = {
    outboxMessage: {
      findUnique: jest.fn().mockResolvedValue(row),
      findFirst: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue(row),
    },
    messageLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    event: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };
  const resend = { sendEmail: jest.fn().mockResolvedValue(undefined) };
  const evolution = { sendWhatsApp: jest.fn().mockResolvedValue(undefined) };
  const ics = { generate: jest.fn().mockReturnValue('BEGIN:VCALENDAR') };
  return { prisma, resend, evolution, ics };
}

describe('MessageDispatchWorker.process', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolves outbox by outboxId when present in job data', async () => {
    const { prisma, resend, evolution, ics } = makeMocks(outboxRow);
    const worker = new MessageDispatchWorker(prisma as any, resend as any, evolution as any, ics as any);
    await worker.process({ data: { outboxId: 'msg-1' } } as any);
    expect(prisma.outboxMessage.findUnique).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
    });
    expect(prisma.outboxMessage.findFirst).not.toHaveBeenCalled();
    expect(resend.sendEmail).toHaveBeenCalled();
  });

  it('falls back to tuple lookup for legacy jobs without outboxId', async () => {
    const { prisma, resend, evolution, ics } = makeMocks(outboxRow);
    const worker = new MessageDispatchWorker(prisma as any, resend as any, evolution as any, ics as any);
    await worker.process({
      data: {
        registrationId: 'reg-1',
        templateId: 'tmpl-1',
        trigger: 'on_registration',
      },
    } as any);
    expect(prisma.outboxMessage.findFirst).toHaveBeenCalled();
    expect(resend.sendEmail).toHaveBeenCalled();
  });

  it('writes MessageLog with null registrationId for manual sends', async () => {
    const manualRow = {
      ...outboxRow,
      id: 'msg-2',
      registrationId: null,
      templateId: null,
      trigger: 'manual',
    };
    const { prisma, resend, evolution, ics } = makeMocks(manualRow);
    const worker = new MessageDispatchWorker(prisma as any, resend as any, evolution as any, ics as any);
    await worker.process({ data: { outboxId: 'msg-2' } } as any);
    expect(prisma.messageLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ registrationId: null, status: 'sent' }),
    });
  });

  it('generates a recurrent ics from inviteConfig and strips the marker', async () => {
    const row = {
      ...outboxRow,
      id: 'inv-1',
      eventId: null,
      renderedBody: 'Veja o convite [[[ICS_INVITE_RECURRENT]]] abaixo',
      inviteConfig: {
        date: '2026-07-01',
        allDay: false,
        startTime: '10:00',
        endTime: '11:00',
        timezone: 'America/Sao_Paulo',
        recurrence: { freq: 'WEEKLY', interval: 1, until: '2026-12-31T20:00:00.000Z' },
      },
    };
    const { prisma, resend, evolution, ics } = makeMocks(row);
    const worker = new MessageDispatchWorker(prisma as any, resend as any, evolution as any, ics as any);
    await worker.process({ data: { outboxId: 'inv-1' } } as any);

    expect(ics.generate).toHaveBeenCalledTimes(1);
    const arg = ics.generate.mock.calls[0][0];
    expect(arg.allDay).toBe(false);
    expect(arg.repeating).toEqual({
      freq: 'WEEKLY',
      interval: 1,
      until: new Date('2026-12-31T20:00:00.000Z'),
    });
    // 10:00 America/Sao_Paulo (UTC-3) == 13:00Z
    expect(arg.start.toISOString()).toBe('2026-07-01T13:00:00.000Z');
    expect(arg.end.toISOString()).toBe('2026-07-01T14:00:00.000Z');

    const [, , body, icsContent] = resend.sendEmail.mock.calls[0];
    expect(body).not.toContain('[[[ICS_INVITE_RECURRENT]]]');
    expect(icsContent).toBe('BEGIN:VCALENDAR');
  });

  it('inviteConfig with allDay ignores times and end', async () => {
    const row = {
      ...outboxRow,
      id: 'inv-2',
      eventId: null,
      renderedBody: '[[[ICS_INVITE]]]',
      inviteConfig: {
        date: '2026-07-01',
        allDay: true,
        timezone: 'America/Sao_Paulo',
        recurrence: null,
      },
    };
    const { prisma, resend, evolution, ics } = makeMocks(row);
    const worker = new MessageDispatchWorker(prisma as any, resend as any, evolution as any, ics as any);
    await worker.process({ data: { outboxId: 'inv-2' } } as any);

    const arg = ics.generate.mock.calls[0][0];
    expect(arg.allDay).toBe(true);
    expect(arg.end).toBeUndefined();
    expect(arg.repeating).toBeUndefined();
  });

  it('non-recurrent marker never sets repeating even with config recurrence', async () => {
    const row = {
      ...outboxRow,
      id: 'inv-3',
      eventId: null,
      renderedBody: '[[[ICS_INVITE]]]',
      inviteConfig: {
        date: '2026-07-01',
        startTime: '10:00',
        endTime: '11:00',
        timezone: 'America/Sao_Paulo',
        recurrence: { freq: 'WEEKLY', interval: 1 },
      },
    };
    const { prisma, resend, evolution, ics } = makeMocks(row);
    const worker = new MessageDispatchWorker(prisma as any, resend as any, evolution as any, ics as any);
    await worker.process({ data: { outboxId: 'inv-3' } } as any);
    expect(ics.generate.mock.calls[0][0].repeating).toBeUndefined();
  });

  it('falls back to the Event when there is no inviteConfig', async () => {
    const row = {
      ...outboxRow,
      id: 'inv-4',
      eventId: 'ev-1',
      renderedBody: '[[[ICS_INVITE_RECURRENT]]]',
      inviteConfig: null,
    };
    const { prisma, resend, evolution, ics } = makeMocks(row);
    prisma.event.findUnique.mockResolvedValue({
      title: 'Tech Day',
      eventDate: new Date('2026-07-01T13:00:00.000Z'),
      endDate: null,
      location: 'SP',
      recurrenceFreq: 'WEEKLY',
      recurrenceInterval: 2,
      recurrenceUntil: null,
    });
    const worker = new MessageDispatchWorker(prisma as any, resend as any, evolution as any, ics as any);
    await worker.process({ data: { outboxId: 'inv-4' } } as any);

    const arg = ics.generate.mock.calls[0][0];
    expect(arg.title).toBe('Tech Day');
    expect(arg.start).toEqual(new Date('2026-07-01T13:00:00.000Z'));
    expect(arg.timezone).toBe('America/Sao_Paulo');
    expect(arg.repeating).toEqual({ freq: 'WEEKLY', interval: 2, until: undefined });
  });

  it('saves ownerId on MessageLog for global sends (no eventId)', async () => {
    const globalRow = {
      ...outboxRow,
      id: 'msg-3',
      eventId: null,
      ownerId: 'user-1',
      registrationId: null,
      templateId: null,
      trigger: 'manual',
      channel: 'email',
    };
    const { prisma, resend, evolution, ics } = makeMocks(globalRow);
    const worker = new MessageDispatchWorker(prisma as any, resend as any, evolution as any, ics as any);
    await worker.process({ data: { outboxId: 'msg-3' } } as any);
    expect(prisma.messageLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ownerId: 'user-1', eventId: null }),
    });
  });
});
