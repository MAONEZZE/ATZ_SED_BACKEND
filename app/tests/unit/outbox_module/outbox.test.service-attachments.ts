import { MessageAttachmentsService } from '@application/outbox_module/message-attachments.service';

describe('MessageAttachmentsService.upload', () => {
  it('uploads under {folder}/{userId}/ and returns metadata', async () => {
    const upload = jest.fn().mockResolvedValue({ url: 'https://cdn/x', path: 'p' });
    const storage = { upload, delete: jest.fn(), getPublicUrl: jest.fn() };
    const cfg: Record<string, string> = {
      SUPABASE_STORAGE_BUCKET: 'ATZ_SED',
      SUPABASE_STORAGE_BUCKET_MESSAGE_ATTACHMENTS: 'message-attachments',
    };
    const svc = new MessageAttachmentsService(
      storage as any,
      { get: (k: string) => cfg[k] } as any,
      {} as any,
    );
    const res = await svc.upload('user-1', {
      buffer: Buffer.from('x'),
      mimetype: 'application/pdf',
      originalname: 'contrato.pdf',
      size: 1,
    } as any);
    const [bucket, path] = upload.mock.calls[0];
    expect(bucket).toBe('ATZ_SED');
    expect(path).toMatch(/^message-attachments\/user-1\/[0-9a-f-]+-contrato\.pdf$/);
    expect(res).toEqual(
      expect.objectContaining({ path, filename: 'contrato.pdf', mimetype: 'application/pdf' }),
    );
  });

  it('collapses .. in filename so the stored path is send-able', async () => {
    const upload = jest.fn().mockResolvedValue({ url: 'https://cdn/x', path: 'p' });
    const storage = { upload, delete: jest.fn(), getPublicUrl: jest.fn() };
    const cfg: Record<string, string> = {
      SUPABASE_STORAGE_BUCKET: 'ATZ_SED',
      SUPABASE_STORAGE_BUCKET_MESSAGE_ATTACHMENTS: 'message-attachments',
    };
    const svc = new MessageAttachmentsService(
      storage as any,
      { get: (k: string) => cfg[k] } as any,
      {} as any,
    );
    const res = await svc.upload('user-1', {
      buffer: Buffer.from('x'),
      mimetype: 'application/pdf',
      originalname: 'a..b.pdf',
      size: 1,
    } as any);
    const [, path] = upload.mock.calls[0];
    expect(path).not.toContain('..');
    expect(res.path).not.toContain('..');
  });
});

describe('MessageAttachmentsService — template attachments', () => {
  function make(referenced = false) {
    const storage = {
      upload: jest.fn().mockResolvedValue({ url: 'https://cdn/x', path: 'p' }),
      delete: jest.fn().mockResolvedValue(undefined),
      getPublicUrl: jest.fn(),
    };
    const config = {
      get: (key: string) => (key === 'SUPABASE_STORAGE_BUCKET' ? 'ATZ_SED' : 'message-attachments'),
    };
    const templates = { isAttachmentPathReferenced: jest.fn().mockResolvedValue(referenced) };
    return {
      service: new MessageAttachmentsService(storage as any, config as any, templates as any),
      storage,
      templates,
    };
  }

  it('accepts PDF/images up to 30 MB and MP4 up to 60 MB', async () => {
    const { service } = make();
    await expect(
      service.uploadTemplate('user-1', {
        buffer: Buffer.from('x'),
        mimetype: 'application/pdf',
        originalname: 'a.pdf',
        size: 30 * 1024 * 1024,
      }),
    ).resolves.toEqual(expect.objectContaining({ name: 'a.pdf', size: 30 * 1024 * 1024 }));
    await expect(
      service.uploadTemplate('user-1', {
        buffer: Buffer.from('x'),
        mimetype: 'video/mp4',
        originalname: 'a.mp4',
        size: 60 * 1024 * 1024,
      }),
    ).resolves.toEqual(expect.objectContaining({ mimetype: 'video/mp4' }));
  });

  it('rejects MOV and the category-specific size limits', async () => {
    const { service } = make();
    await expect(
      service.uploadTemplate('user-1', {
        buffer: Buffer.from('x'),
        mimetype: 'video/quicktime',
        originalname: 'a.mov',
        size: 1,
      }),
    ).rejects.toThrow();
    await expect(
      service.uploadTemplate('user-1', {
        buffer: Buffer.from('x'),
        mimetype: 'image/png',
        originalname: 'a.png',
        size: 30 * 1024 * 1024 + 1,
      }),
    ).rejects.toThrow(/30 MB/);
  });

  it('validates the owner prefix and traversal', () => {
    const { service } = make();
    const base = { name: 'a.pdf', mimetype: 'application/pdf', size: 1 };
    expect(() =>
      service.assertOwned('user-1', {
        ...base,
        path: 'message-attachments/user-2/a.pdf',
      }),
    ).toThrow();
    expect(() =>
      service.assertOwned('user-1', {
        ...base,
        path: 'message-attachments/user-1/../a.pdf',
      }),
    ).toThrow();
  });

  it('deletes only when neither another template nor pending outbox references the path', async () => {
    const used = make(true);
    await used.service.deleteIfUnreferenced('message-attachments/user-1/a.pdf');
    expect(used.storage.delete).not.toHaveBeenCalled();

    const unused = make(false);
    await unused.service.deleteIfUnreferenced('message-attachments/user-1/a.pdf');
    expect(unused.storage.delete).toHaveBeenCalledWith(
      'ATZ_SED',
      'message-attachments/user-1/a.pdf',
    );
  });
});
