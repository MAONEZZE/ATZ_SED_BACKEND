import { convertLegacyDocumentValue } from '@application/registration_module/form-document-backfill';

describe('convertLegacyDocumentValue', () => {
  it('wraps a legacy URL in the new file object array', async () => {
    const upload = jest.fn();
    await expect(
      convertLegacyDocumentValue('https://cdn.example.com/docs/contrato.pdf?download=1', upload),
    ).resolves.toEqual({
      changed: true,
      value: [
        {
          url: 'https://cdn.example.com/docs/contrato.pdf?download=1',
          name: 'contrato.pdf',
          mimetype: null,
          size: null,
        },
      ],
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it('decodes a residual data URI and delegates its storage', async () => {
    const stored = {
      url: 'https://cdn/new.png',
      name: 'imagem-legada.png',
      mimetype: 'image/png',
      size: 1,
    };
    const upload = jest.fn().mockResolvedValue(stored);
    const result = await convertLegacyDocumentValue('data:image/png;base64,QQ==', upload);
    expect(result).toEqual({ changed: true, value: [stored] });
    expect(upload).toHaveBeenCalledWith({
      mimetype: 'image/png',
      binary: Buffer.from('A'),
      extension: 'png',
    });
  });

  it('is idempotent for values already in the new format', async () => {
    const value = [{ url: 'https://cdn/a.pdf', name: 'a.pdf', mimetype: null, size: null }];
    await expect(convertLegacyDocumentValue(value, jest.fn())).resolves.toEqual({
      changed: false,
      value,
    });
  });
});
