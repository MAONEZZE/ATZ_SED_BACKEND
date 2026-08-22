import { OutboxMaintenanceService } from '@application/workers/outbox-maintenance.service';

const PRUNE_DAYS_MS = 180 * 24 * 60 * 60 * 1000;

describe('OutboxMaintenanceService.prune', () => {
  it('deletes sent rows older than 180 days', async () => {
    const outbox = { deleteSentOlderThan: jest.fn().mockResolvedValue(3) };
    const service = new OutboxMaintenanceService(outbox as any);

    const before = Date.now();
    await service.prune();
    const after = Date.now();

    expect(outbox.deleteSentOlderThan).toHaveBeenCalledTimes(1);
    const [cutoff] = outbox.deleteSentOlderThan.mock.calls[0] as [Date];
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - PRUNE_DAYS_MS - 1000);
    expect(cutoff.getTime()).toBeLessThanOrEqual(after - PRUNE_DAYS_MS + 1000);
  });

  it('does not throw when the repository fails, only logs', async () => {
    const outbox = { deleteSentOlderThan: jest.fn().mockRejectedValue(new Error('db down')) };
    const service = new OutboxMaintenanceService(outbox as any);

    await expect(service.prune()).resolves.toBeUndefined();
  });
});
