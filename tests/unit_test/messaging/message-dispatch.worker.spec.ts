import { MessageDispatchWorker } from '@workers/message-dispatch.worker';
import { DelayedError, UnrecoverableError } from 'bullmq';
import { WhatsappRestrictionError } from '@infra/integrations/whatsapp.adapter';

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
  attachments: null,
  sentAttachments: 0,
};

function makeMocks(row: unknown) {
  const outboxRepo = {
    findDispatchById: jest.fn().mockResolvedValue(row),
    findPendingDispatchByTrigger: jest.fn().mockResolvedValue(row),
    markProcessingAttempt: jest.fn().mockResolvedValue(undefined),
    updateSentParts: jest.fn().mockResolvedValue(undefined),
    updateSentAttachments: jest.fn().mockResolvedValue(undefined),
    markDispatchSent: jest.fn().mockResolvedValue(undefined),
    markDispatchFailed: jest.fn().mockResolvedValue(undefined),
  };
  const messageLogs = {
    create: jest.fn().mockResolvedValue(undefined),
  };
  const eventRepo = {
    findById: jest.fn().mockResolvedValue(null),
    findWhatsappInstanceToken: jest.fn().mockResolvedValue(null),
  };
  const resend = { sendEmail: jest.fn().mockResolvedValue(undefined) };
  const whatsapp = {
    sendWhatsApp: jest.fn().mockResolvedValue('wamid.TEXT'),
    sendMedia: jest.fn().mockResolvedValue('wamid.MEDIA'),
  };
  const ics = { generate: jest.fn().mockReturnValue('BEGIN:VCALENDAR') };
  // Gate OFF por padrão; pacing não deve ser tocado nos testes legados.
  const pacing = { nextDelayMs: jest.fn().mockResolvedValue(0) };
  const config = { get: jest.fn().mockReturnValue(false) };
  return { outboxRepo, messageLogs, eventRepo, resend, whatsapp, ics, pacing, config };
}

function makeWorker(m: ReturnType<typeof makeMocks>) {
  return new MessageDispatchWorker(
    m.outboxRepo as any,
    m.messageLogs as any,
    m.eventRepo as any,
    m.resend as any,
    m.whatsapp as any,
    m.ics as any,
    m.pacing as any,
    m.config as any,
  );
}

describe('MessageDispatchWorker.process', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolves outbox by outboxId when present in job data', async () => {
    const m = makeMocks(outboxRow);
    const worker = makeWorker(m);
    await worker.process({ data: { outboxId: 'msg-1' } } as any);
    expect(m.outboxRepo.findDispatchById).toHaveBeenCalledWith('msg-1');
    expect(m.outboxRepo.findPendingDispatchByTrigger).not.toHaveBeenCalled();
    expect(m.resend.sendEmail).toHaveBeenCalled();
  });

  it('falls back to tuple lookup for legacy jobs without outboxId', async () => {
    const m = makeMocks(outboxRow);
    const worker = makeWorker(m);
    await worker.process({
      data: {
        registrationId: 'reg-1',
        templateId: 'tmpl-1',
        trigger: 'on_registration',
      },
    } as any);
    expect(m.outboxRepo.findPendingDispatchByTrigger).toHaveBeenCalled();
    expect(m.resend.sendEmail).toHaveBeenCalled();
  });

  it('writes MessageLog with null registrationId for manual sends', async () => {
    const manualRow = {
      ...outboxRow,
      id: 'msg-2',
      registrationId: null,
      templateId: null,
      trigger: 'manual',
    };
    const m = makeMocks(manualRow);
    const worker = makeWorker(m);
    await worker.process({ data: { outboxId: 'msg-2' } } as any);
    expect(m.messageLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({ registrationId: null, status: 'sent' }),
    );
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
    const m = makeMocks(row);
    const worker = makeWorker(m);
    await worker.process({ data: { outboxId: 'inv-1' } } as any);

    expect(m.ics.generate).toHaveBeenCalledTimes(1);
    const arg = m.ics.generate.mock.calls[0][0];
    expect(arg.allDay).toBe(false);
    expect(arg.repeating).toEqual({
      freq: 'WEEKLY',
      interval: 1,
      until: new Date('2026-12-31T20:00:00.000Z'),
    });
    // 10:00 America/Sao_Paulo (UTC-3) == 13:00Z
    expect(arg.start.toISOString()).toBe('2026-07-01T13:00:00.000Z');
    expect(arg.end.toISOString()).toBe('2026-07-01T14:00:00.000Z');

    const [, , body, icsContent] = m.resend.sendEmail.mock.calls[0];
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
    const m = makeMocks(row);
    const worker = makeWorker(m);
    await worker.process({ data: { outboxId: 'inv-2' } } as any);

    const arg = m.ics.generate.mock.calls[0][0];
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
    const m = makeMocks(row);
    const worker = makeWorker(m);
    await worker.process({ data: { outboxId: 'inv-3' } } as any);
    expect(m.ics.generate.mock.calls[0][0].repeating).toBeUndefined();
  });

  it('falls back to the Event when there is no inviteConfig', async () => {
    const row = {
      ...outboxRow,
      id: 'inv-4',
      eventId: 'ev-1',
      renderedBody: '[[[ICS_INVITE_RECURRENT]]]',
      inviteConfig: null,
    };
    const m = makeMocks(row);
    m.eventRepo.findById.mockResolvedValue({
      title: 'Tech Day',
      eventDate: new Date('2026-07-01T13:00:00.000Z'),
      endDate: null,
      location: 'SP',
      recurrenceFreq: 'WEEKLY',
      recurrenceInterval: 2,
      recurrenceUntil: null,
    });
    const worker = makeWorker(m);
    await worker.process({ data: { outboxId: 'inv-4' } } as any);

    const arg = m.ics.generate.mock.calls[0][0];
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
    const m = makeMocks(globalRow);
    const worker = makeWorker(m);
    await worker.process({ data: { outboxId: 'msg-3' } } as any);
    expect(m.messageLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'user-1', eventId: null }),
    );
  });

  it('sends email attachments as the 5th sendEmail arg', async () => {
    const row = {
      ...outboxRow,
      id: 'att-email-1',
      eventId: null,
      channel: 'email',
      attachments: [{ url: 'https://cdn/f.pdf', filename: 'f.pdf', mimetype: 'application/pdf' }],
      sentAttachments: 0,
    };
    const m = makeMocks(row);
    const worker = makeWorker(m);
    await worker.process({ data: { outboxId: 'att-email-1' } } as any);

    const fifthArg = m.resend.sendEmail.mock.calls[0][4];
    expect(fifthArg).toEqual([{ filename: 'f.pdf', url: 'https://cdn/f.pdf' }]);
  });

  it('resumes whatsapp media from sentAttachments, sending only the remaining one', async () => {
    const row = {
      ...outboxRow,
      id: 'att-wa-1',
      eventId: null,
      ownerId: null,
      channel: 'whatsapp',
      instancia: 'inst-1',
      sentParts: 0,
      attachments: [
        { url: 'https://cdn/a.pdf', filename: 'a.pdf', mimetype: 'application/pdf' },
        { url: 'https://cdn/b.png', filename: 'b.png', mimetype: 'image/png' },
      ],
      sentAttachments: 1,
    };
    const m = makeMocks(row);
    const worker = makeWorker(m);
    await worker.process({ data: { outboxId: 'att-wa-1' } } as any);

    expect(m.whatsapp.sendMedia).toHaveBeenCalledTimes(1);
    expect(m.whatsapp.sendMedia).toHaveBeenCalledWith(
      'inst-1',
      'a@b.com',
      'https://cdn/b.png',
      'image',
      'image/png',
      'b.png',
      undefined,
      'att-wa-1',
    );
    expect(m.outboxRepo.updateSentAttachments).toHaveBeenCalledWith('att-wa-1', 2);
    // providerMessageId (representativo = última mídia) persistido no outbox
    expect(m.outboxRepo.markDispatchSent).toHaveBeenCalledWith('att-wa-1', 'wamid.MEDIA');
  });

  it('maps image mimetype to mediatype image', async () => {
    const row = {
      ...outboxRow,
      id: 'att-wa-2',
      eventId: null,
      ownerId: null,
      channel: 'whatsapp',
      instancia: 'inst-1',
      sentParts: 0,
      attachments: [{ url: 'https://cdn/c.jpg', filename: 'c.jpg', mimetype: 'image/jpeg' }],
      sentAttachments: 0,
    };
    const m = makeMocks(row);
    const worker = makeWorker(m);
    await worker.process({ data: { outboxId: 'att-wa-2' } } as any);

    expect(m.whatsapp.sendMedia.mock.calls[0][3]).toBe('image');
  });
});

describe('MessageDispatchWorker.process — DISPATCH_GATE_ENABLED (re-pacing no retry)', () => {
  beforeEach(() => jest.clearAllMocks());

  const waRow = {
    ...outboxRow,
    id: 'wa-1',
    channel: 'whatsapp',
    recipient: '5511999999999',
    instancia: 'tok-1', // token → resolveWhatsAppInstance devolve sem lookup de evento
    sentParts: 0,
  };

  function gateWorker(row: unknown) {
    const m = makeMocks(row);
    m.config.get.mockReturnValue(true); // gate ON
    m.pacing.nextDelayMs.mockResolvedValue(50000);
    const worker = makeWorker(m);
    return { worker, ...m };
  }

  function makeJob(overrides: { attemptsMade: number; data?: Record<string, unknown> }) {
    return {
      data: { outboxId: 'wa-1', ...(overrides.data ?? {}) },
      attemptsMade: overrides.attemptsMade,
      updateData: jest.fn().mockResolvedValue(undefined),
      moveToDelayed: jest.fn().mockResolvedValue(undefined),
    } as any;
  }

  it('1ª tentativa (attemptsMade=0): não reserva nem reagenda, envia', async () => {
    const { worker, pacing, whatsapp } = gateWorker(waRow);
    const job = makeJob({ attemptsMade: 0 });
    await worker.process(job, 'tok-abc');
    expect(pacing.nextDelayMs).not.toHaveBeenCalled();
    expect(job.moveToDelayed).not.toHaveBeenCalled();
    expect(whatsapp.sendWhatsApp).toHaveBeenCalled();
  });

  it('retry sem marcador: reserva 1x, grava pacedForAttempt, reagenda e lança DelayedError', async () => {
    const { worker, pacing, whatsapp, outboxRepo } = gateWorker(waRow);
    const job = makeJob({ attemptsMade: 1 });
    await expect(worker.process(job, 'tok-abc')).rejects.toThrow(DelayedError);
    expect(pacing.nextDelayMs).toHaveBeenCalledTimes(1);
    expect(pacing.nextDelayMs).toHaveBeenCalledWith('tok-1');
    expect(job.updateData).toHaveBeenCalledWith(
      expect.objectContaining({ pacedForAttempt: 1 }),
    );
    expect(job.moveToDelayed).toHaveBeenCalledTimes(1);
    // 2º arg é o token do worker (necessário p/ moveToDelayed)
    expect(job.moveToDelayed.mock.calls[0][1]).toBe('tok-abc');
    // deferral NÃO envia nem marca a row como processing
    expect(whatsapp.sendWhatsApp).not.toHaveBeenCalled();
    expect(outboxRepo.markProcessingAttempt).not.toHaveBeenCalled();
  });

  it('re-pick pós-deferral (marcador == attemptsMade): NÃO reserva de novo, envia (anti-drift)', async () => {
    const { worker, pacing, whatsapp } = gateWorker(waRow);
    const job = makeJob({ attemptsMade: 1, data: { pacedForAttempt: 1 } });
    await worker.process(job, 'tok-abc');
    expect(pacing.nextDelayMs).not.toHaveBeenCalled();
    expect(job.moveToDelayed).not.toHaveBeenCalled();
    expect(whatsapp.sendWhatsApp).toHaveBeenCalled();
  });

  it('nextDelayMs retorna 0: não defere, envia', async () => {
    const { worker, pacing, whatsapp } = gateWorker(waRow);
    pacing.nextDelayMs.mockResolvedValue(0);
    const job = makeJob({ attemptsMade: 1 });
    await worker.process(job, 'tok-abc');
    expect(pacing.nextDelayMs).toHaveBeenCalledTimes(1);
    expect(job.moveToDelayed).not.toHaveBeenCalled();
    expect(whatsapp.sendWhatsApp).toHaveBeenCalled();
  });

  it('sem token do worker (process sem 2º arg): gate não roda, envia', async () => {
    const { worker, pacing, whatsapp } = gateWorker(waRow);
    const job = makeJob({ attemptsMade: 3 });
    await worker.process(job); // sem token
    expect(pacing.nextDelayMs).not.toHaveBeenCalled();
    expect(whatsapp.sendWhatsApp).toHaveBeenCalled();
  });
});

describe('MessageDispatchWorker.process — restrição do WhatsApp (463) não-retentável', () => {
  beforeEach(() => jest.clearAllMocks());

  const waRow = {
    ...outboxRow,
    id: 'wa-463',
    channel: 'whatsapp',
    recipient: '5511999999999',
    instancia: 'tok-1',
    sentParts: 0,
  };

  it('WhatsappRestrictionError → marca failed e relança UnrecoverableError (sem retry)', async () => {
    const m = makeMocks(waRow);
    m.whatsapp.sendWhatsApp.mockRejectedValue(
      new WhatsappRestrictionError('timelock', 463, new Date('2026-07-30T03:54:45Z')),
    );
    const worker = makeWorker(m);

    await expect(worker.process({ data: { outboxId: 'wa-463' } } as any)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );

    // outbox marcado failed com a mensagem do erro
    expect(m.outboxRepo.markDispatchFailed).toHaveBeenCalledWith('wa-463', 'timelock');
    // log de falha criado
    expect(m.messageLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
  });
});
