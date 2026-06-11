import { OutboxService } from '@services/messaging/outbox.service';

const mockOutboxRepo = {
  enqueue: jest.fn().mockResolvedValue({ id: 'msg-1' }),
};

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  clean: jest.fn().mockResolvedValue([]),
};

const service = new OutboxService(mockOutboxRepo as any, mockQueue as any, mockQueue as any);

const baseData = {
  eventId: 'evt-1',
  registrationId: 'reg-1',
  templateId: 'tmpl-1',
  trigger: 'on_registration',
  channel: 'email' as const,
  recipient: 'test@example.com',
  renderedBody: '<p>Hello</p>',
};

describe('OutboxService.enqueue', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls outboxRepo.enqueue once per call with legacy dedupKey computed', async () => {
    await service.enqueue(baseData);
    expect(mockOutboxRepo.enqueue).toHaveBeenCalledTimes(1);
    expect(mockOutboxRepo.enqueue).toHaveBeenCalledWith({
      ...baseData,
      dedupKey: 'reg-1:tmpl-1:on_registration',
    });
  });

  it('adds job to queue with deterministic jobId (sem ":" — BullMQ proíbe) e outboxId no payload', async () => {
    await service.enqueue(baseData);
    expect(mockQueue.add).toHaveBeenCalledWith(
      'dispatch',
      expect.objectContaining({
        outboxId: 'msg-1',
        registrationId: 'reg-1',
        templateId: 'tmpl-1',
        trigger: 'on_registration',
      }),
      expect.objectContaining({ jobId: 'reg-1_tmpl-1_on_registration' }),
    );
  });

  it('deriva jobId do dedupKey explícito sanitizando ":" (manual send)', async () => {
    await service.enqueue({
      ...baseData,
      registrationId: undefined,
      templateId: undefined,
      trigger: 'manual',
      dedupKey: 'manual:evt-1:test@example.com:abc123',
    });
    // dedupKey do banco preserva o formato original
    expect(mockOutboxRepo.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ dedupKey: 'manual:evt-1:test@example.com:abc123' }),
    );
    // jobId do BullMQ não pode conter ":" (Job.addJob lança "Custom Id cannot contain :")
    expect(mockQueue.add).toHaveBeenCalledWith(
      'dispatch',
      expect.objectContaining({ outboxId: 'msg-1', trigger: 'manual' }),
      expect.objectContaining({ jobId: 'manual_evt-1_test@example.com_abc123' }),
    );
  });

  it('jobId nunca contém ":" (regra BullMQ 5.x)', async () => {
    await service.enqueue({
      ...baseData,
      dedupKey: 'a:b:c:d:e',
    });
    const jobId = mockQueue.add.mock.calls[0][2].jobId as string;
    expect(jobId).not.toContain(':');
  });

  it('passa delay para queue.add quando opts.delayMs informado (pacing WhatsApp)', async () => {
    await service.enqueue(baseData, { delayMs: 15000 });
    expect(mockQueue.add).toHaveBeenCalledWith(
      'dispatch',
      expect.any(Object),
      expect.objectContaining({ delay: 15000 }),
    );
  });

  it('usa delay 0 quando opts ausente', async () => {
    await service.enqueue(baseData);
    expect(mockQueue.add).toHaveBeenCalledWith(
      'dispatch',
      expect.any(Object),
      expect.objectContaining({ delay: 0 }),
    );
  });

  it('não lança se queue.add falhar, mas loga erro real (não engole como dedup)', async () => {
    const errorSpy = jest.spyOn(service['logger'], 'error').mockImplementation();
    mockQueue.add.mockRejectedValueOnce(new Error('Custom Id cannot contain :'));
    await expect(service.enqueue(baseData)).resolves.not.toThrow();
    expect(mockOutboxRepo.enqueue).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
