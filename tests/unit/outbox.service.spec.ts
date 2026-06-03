import { OutboxService } from '@services/messaging/outbox.service';

const mockOutboxRepo = {
  enqueue: jest.fn().mockResolvedValue(undefined),
};

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

const service = new OutboxService(mockOutboxRepo as any, mockQueue as any);

const baseData = {
  registrationId: 'reg-1',
  templateId: 'tmpl-1',
  trigger: 'on_registration',
  channel: 'email' as const,
  recipient: 'test@example.com',
  renderedBody: '<p>Hello</p>',
};

describe('OutboxService.enqueue', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls outboxRepo.enqueue once per call', async () => {
    await service.enqueue(baseData);
    expect(mockOutboxRepo.enqueue).toHaveBeenCalledTimes(1);
    expect(mockOutboxRepo.enqueue).toHaveBeenCalledWith(baseData);
  });

  it('adds job to queue with deterministic jobId', async () => {
    await service.enqueue(baseData);
    expect(mockQueue.add).toHaveBeenCalledWith(
      'dispatch',
      expect.objectContaining({
        registrationId: 'reg-1',
        templateId: 'tmpl-1',
        trigger: 'on_registration',
      }),
      expect.objectContaining({ jobId: 'reg-1:tmpl-1:on_registration' }),
    );
  });

  it('does not throw if queue.add throws (already queued)', async () => {
    mockQueue.add.mockRejectedValueOnce(new Error('Job already exists'));
    await expect(service.enqueue(baseData)).resolves.not.toThrow();
    expect(mockOutboxRepo.enqueue).toHaveBeenCalledTimes(1);
  });
});
