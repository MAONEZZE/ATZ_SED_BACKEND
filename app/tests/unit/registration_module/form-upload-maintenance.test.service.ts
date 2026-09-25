import { FormUploadMaintenanceService } from '@application/workers/form-upload-maintenance.service';

describe('FormUploadMaintenanceService', () => {
  it('prunes files older than 24 hours', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-25T12:00:00Z'));
    const documents = { deleteTemporaryOlderThan: jest.fn().mockResolvedValue(2) };
    const service = new FormUploadMaintenanceService(documents as any);

    await service.prune();

    expect(documents.deleteTemporaryOlderThan).toHaveBeenCalledWith(
      new Date('2026-09-24T12:00:00Z'),
    );
    jest.useRealTimers();
  });
});
