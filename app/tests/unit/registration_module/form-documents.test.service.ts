import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FormDocumentsService } from '@application/registration_module/form-documents.service';

function make(overrides?: { status?: string; fieldType?: string }) {
  const storage = {
    upload: jest
      .fn()
      .mockImplementation((_bucket, path) =>
        Promise.resolve({ path, url: `https://cdn/ATZ_SED/${path}` }),
      ),
    delete: jest.fn().mockResolvedValue(undefined),
    move: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue([]),
    getPublicUrl: jest.fn().mockImplementation((_bucket, path) => `https://cdn/ATZ_SED/${path}`),
  };
  const config = {
    get: jest
      .fn()
      .mockImplementation((key: string) =>
        key === 'SUPABASE_STORAGE_BUCKET' ? 'ATZ_SED' : 'registration-uploads',
      ),
  };
  const forms = { findById: jest.fn().mockResolvedValue({ id: 'form-1', eventId: 'evt-1' }) };
  const fields = {
    findByForm: jest.fn().mockResolvedValue({
      id: 'field-1',
      formId: 'form-1',
      type: overrides?.fieldType ?? 'document',
    }),
  };
  const events = {
    findById: jest
      .fn()
      .mockResolvedValue({ id: 'evt-1', status: overrides?.status ?? 'published' }),
  };
  const service = new FormDocumentsService(
    storage as any,
    config as any,
    forms as any,
    fields as any,
    events as any,
  );
  return { service, storage, forms, fields, events };
}

const pdf = {
  buffer: Buffer.from('%PDF'),
  originalname: 'contrato.pdf',
  mimetype: 'application/pdf',
  size: 4,
};

describe('FormDocumentsService uploads', () => {
  it('stores public uploads under tmp/formId and returns the response object', async () => {
    const { service, storage } = make();
    const result = await service.uploadTemporary('form-1', 'field-1', pdf);
    expect(storage.upload.mock.calls[0][1]).toMatch(
      /^registration-uploads\/tmp\/form-1\/[0-9a-f-]{36}\.pdf$/,
    );
    expect(result).toEqual({
      url: expect.any(String),
      name: 'contrato.pdf',
      mimetype: 'application/pdf',
      size: 4,
    });
  });

  it('stores panel uploads directly under event/form', async () => {
    const { service, storage } = make();
    await service.uploadFinal('evt-1', 'form-1', 'field-1', pdf);
    expect(storage.upload.mock.calls[0][1]).toMatch(
      /^registration-uploads\/evt-1\/form-1\/[0-9a-f-]{36}\.pdf$/,
    );
  });

  it('rejects closed forms and non-document fields', async () => {
    await expect(
      make({ status: 'draft' }).service.uploadTemporary('form-1', 'field-1', pdf),
    ).rejects.toThrow(BadRequestException);
    await expect(
      make({ fieldType: 'text' }).service.uploadTemporary('form-1', 'field-1', pdf),
    ).rejects.toThrow(NotFoundException);
  });

  it('applies 10 MB to documents and 50 MB to video', async () => {
    const { service } = make();
    await expect(
      service.uploadTemporary('form-1', 'field-1', { ...pdf, size: 10 * 1024 * 1024 + 1 }),
    ).rejects.toThrow(/10 MB/);
    await expect(
      service.uploadTemporary('form-1', 'field-1', {
        ...pdf,
        originalname: 'video.mov',
        mimetype: 'video/quicktime',
        size: 40 * 1024 * 1024,
      }),
    ).resolves.toEqual(expect.objectContaining({ mimetype: 'video/quicktime' }));
  });

  it('rejects a mime outside the allowlist', async () => {
    await expect(
      make().service.uploadTemporary('form-1', 'field-1', {
        ...pdf,
        mimetype: 'application/zip',
      }),
    ).rejects.toThrow(/não permitido/);
  });
});

describe('FormDocumentsService.finalizeAnswers', () => {
  const fields = [
    {
      id: 'field-1',
      label: 'Documento',
      type: 'document',
      required: false,
      options: { maxFiles: 2 },
      isFixed: false,
    },
  ];
  const temporary = {
    url: 'https://cdn/ATZ_SED/registration-uploads/tmp/form-1/file.pdf',
    name: 'file.pdf',
    mimetype: 'application/pdf',
    size: 4,
  };

  it('moves a temporary upload and rewrites its URL', async () => {
    const { service, storage } = make();
    const result = await service.finalizeAnswers({ Documento: [temporary] }, fields, {
      eventId: 'evt-1',
      formId: 'form-1',
    });
    expect(storage.move).toHaveBeenCalledWith(
      'ATZ_SED',
      'registration-uploads/tmp/form-1/file.pdf',
      'registration-uploads/evt-1/form-1/file.pdf',
    );
    expect(result.Documento).toEqual([
      expect.objectContaining({
        url: 'https://cdn/ATZ_SED/registration-uploads/evt-1/form-1/file.pdf',
      }),
    ]);
  });

  it('accepts an already-final panel URL and rejects another form prefix', async () => {
    const { service, storage } = make();
    const final = {
      ...temporary,
      url: 'https://cdn/ATZ_SED/registration-uploads/evt-1/form-1/file.pdf',
    };
    await expect(
      service.finalizeAnswers({ Documento: [final] }, fields, {
        eventId: 'evt-1',
        formId: 'form-1',
      }),
    ).resolves.toEqual({ Documento: [final] });
    expect(storage.move).not.toHaveBeenCalled();

    await expect(
      service.finalizeAnswers(
        {
          Documento: [
            { ...temporary, url: 'https://cdn/ATZ_SED/registration-uploads/tmp/form-2/file.pdf' },
          ],
        },
        fields,
        { eventId: 'evt-1', formId: 'form-1' },
      ),
    ).rejects.toThrow(/não pertence/);
  });

  it('rejects a data URI before touching storage', async () => {
    const { service, storage } = make();
    await expect(
      service.finalizeAnswers(
        { Documento: [{ ...temporary, url: 'data:application/pdf;base64,AA==' }] },
        fields,
        { eventId: 'evt-1', formId: 'form-1' },
      ),
    ).rejects.toThrow(/data URI/);
    expect(storage.move).not.toHaveBeenCalled();
  });

  it('deletes only temporary objects older than the cutoff', async () => {
    const { service, storage } = make();
    storage.list.mockResolvedValue([
      { path: 'registration-uploads/tmp/form-1/old.pdf', updatedAt: new Date('2026-09-20') },
      { path: 'registration-uploads/tmp/form-1/new.pdf', updatedAt: new Date('2026-09-25') },
    ]);
    await expect(service.deleteTemporaryOlderThan(new Date('2026-09-24'))).resolves.toBe(1);
    expect(storage.delete).toHaveBeenCalledWith(
      'ATZ_SED',
      'registration-uploads/tmp/form-1/old.pdf',
    );
  });
});
