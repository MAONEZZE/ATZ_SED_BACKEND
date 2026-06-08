import { MessageDispatchWorker } from '../../app/api/workers/message-dispatch.worker';

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
  };
  const resend = { sendEmail: jest.fn().mockResolvedValue(undefined) };
  const evolution = { sendWhatsApp: jest.fn().mockResolvedValue(undefined) };
  return { prisma, resend, evolution };
}

describe('MessageDispatchWorker.process', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolves outbox by outboxId when present in job data', async () => {
    const { prisma, resend, evolution } = makeMocks(outboxRow);
    const worker = new MessageDispatchWorker(prisma as any, resend as any, evolution as any);
    await worker.process({ data: { outboxId: 'msg-1' } } as any);
    expect(prisma.outboxMessage.findUnique).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
    });
    expect(prisma.outboxMessage.findFirst).not.toHaveBeenCalled();
    expect(resend.sendEmail).toHaveBeenCalled();
  });

  it('falls back to tuple lookup for legacy jobs without outboxId', async () => {
    const { prisma, resend, evolution } = makeMocks(outboxRow);
    const worker = new MessageDispatchWorker(prisma as any, resend as any, evolution as any);
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
    const { prisma, resend, evolution } = makeMocks(manualRow);
    const worker = new MessageDispatchWorker(prisma as any, resend as any, evolution as any);
    await worker.process({ data: { outboxId: 'msg-2' } } as any);
    expect(prisma.messageLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ registrationId: null, status: 'sent' }),
    });
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
    const { prisma, resend, evolution } = makeMocks(globalRow);
    const worker = new MessageDispatchWorker(prisma as any, resend as any, evolution as any);
    await worker.process({ data: { outboxId: 'msg-3' } } as any);
    expect(prisma.messageLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ownerId: 'user-1', eventId: null }),
    });
  });
});
