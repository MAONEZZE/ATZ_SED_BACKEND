import { MessageAttachmentsService } from '@modules/messaging/message-attachments.service';

describe('MessageAttachmentsService.upload', () => {
  it('uploads under {folder}/{userId}/ and returns metadata', async () => {
    const upload = jest.fn().mockResolvedValue({ url: 'https://cdn/x', path: 'p' });
    const storage = { upload, delete: jest.fn(), getPublicUrl: jest.fn() };
    const cfg: Record<string, string> = {
      SUPABASE_STORAGE_BUCKET: 'ATZ_SED',
      SUPABASE_STORAGE_BUCKET_MESSAGE_ATTACHMENTS: 'message-attachments',
    };
    const svc = new MessageAttachmentsService(storage as any, { get: (k: string) => cfg[k] } as any);
    const res = await svc.upload('user-1', { buffer: Buffer.from('x'), mimetype: 'application/pdf', originalname: 'contrato.pdf', size: 1 } as any);
    const [bucket, path] = upload.mock.calls[0];
    expect(bucket).toBe('ATZ_SED');
    expect(path).toMatch(/^message-attachments\/user-1\/[0-9a-f-]+-contrato\.pdf$/);
    expect(res).toEqual(expect.objectContaining({ path, filename: 'contrato.pdf', mimetype: 'application/pdf' }));
  });

  it('collapses .. in filename so the stored path is send-able', async () => {
    const upload = jest.fn().mockResolvedValue({ url: 'https://cdn/x', path: 'p' });
    const storage = { upload, delete: jest.fn(), getPublicUrl: jest.fn() };
    const cfg: Record<string, string> = {
      SUPABASE_STORAGE_BUCKET: 'ATZ_SED',
      SUPABASE_STORAGE_BUCKET_MESSAGE_ATTACHMENTS: 'message-attachments',
    };
    const svc = new MessageAttachmentsService(storage as any, { get: (k: string) => cfg[k] } as any);
    const res = await svc.upload('user-1', { buffer: Buffer.from('x'), mimetype: 'application/pdf', originalname: 'a..b.pdf', size: 1 } as any);
    const [, path] = upload.mock.calls[0];
    expect(path).not.toContain('..');
    expect(res.path).not.toContain('..');
  });
});
