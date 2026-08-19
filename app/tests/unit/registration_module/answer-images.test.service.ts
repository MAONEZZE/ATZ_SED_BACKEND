import { BadRequestException } from '@nestjs/common';
import { AnswerImageService } from '@application/registration_module/answer-images.service';

const SCOPE = { eventId: 'evt-1', formId: 'form-1' };
const URL = 'https://proj.supabase.co/storage/v1/object/public/ATZ_SED/x.jpg';

/** 1x1 PNG de verdade, para o caminho felizinho não depender de base64 inventado. */
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF+kQ2wAAAAAElFTkSuQmCC';

function make(uploadImpl?: jest.Mock) {
  const storage = {
    upload: uploadImpl ?? jest.fn().mockResolvedValue({ url: URL, path: 'p' }),
    delete: jest.fn(),
    getPublicUrl: jest.fn(),
  };
  const config = {
    get: jest.fn().mockImplementation((key: string) =>
      key === 'SUPABASE_STORAGE_BUCKET' ? 'ATZ_SED' : 'registration-uploads',
    ),
  };
  return { svc: new AnswerImageService(storage as any, config as any), storage };
}

describe('AnswerImageService.materialize', () => {
  it('replaces a data URI with the bucket URL', async () => {
    const { svc, storage } = make();

    const out = await svc.materialize(
      { Foto: `data:image/png;base64,${PNG_1X1}`, Nome: 'João' },
      SCOPE,
    );

    expect(out.Foto).toBe(URL);
    expect(out.Nome).toBe('João');
    expect(storage.upload).toHaveBeenCalledTimes(1);
  });

  it('uploads the decoded binary, not the base64 string', async () => {
    const { svc, storage } = make();

    await svc.materialize({ Foto: `data:image/png;base64,${PNG_1X1}` }, SCOPE);

    const [, , buffer, mime] = storage.upload.mock.calls[0];
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBe(Buffer.from(PNG_1X1, 'base64').length);
    expect(buffer.length).toBeLessThan(PNG_1X1.length);
    expect(mime).toBe('image/png');
  });

  it('puts the file under the event and form, with the mime extension', async () => {
    const { svc, storage } = make();

    await svc.materialize({ Foto: `data:image/jpeg;base64,${PNG_1X1}` }, SCOPE);

    const [bucket, path] = storage.upload.mock.calls[0];
    expect(bucket).toBe('ATZ_SED');
    expect(path).toMatch(/^registration-uploads\/evt-1\/form-1\/[0-9a-f-]{36}\.jpg$/);
  });

  // Sem formId é a edição pelo painel: o inscrito não pertence a um formulário só.
  it('falls back to a panel folder when there is no formId', async () => {
    const { svc, storage } = make();

    await svc.materialize({ Foto: `data:image/png;base64,${PNG_1X1}` }, { eventId: 'evt-1' });

    expect(storage.upload.mock.calls[0][1]).toMatch(/^registration-uploads\/evt-1\/painel\//);
  });

  // É o que permite chamar na submissão e na edição sem subir duas vezes.
  it('leaves an already stored URL untouched', async () => {
    const { svc, storage } = make();

    const out = await svc.materialize({ Foto: URL }, SCOPE);

    expect(out.Foto).toBe(URL);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('does not touch answers without a data URI', async () => {
    const { svc, storage } = make();

    const answers = { Nome: 'João', Nota: 9, Aceito: true, Tags: ['a', 'b'], Vazio: null };
    const out = await svc.materialize(answers, SCOPE);

    expect(out).toEqual(answers);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('converts every data URI inside an array', async () => {
    const { svc, storage } = make();

    const out = await svc.materialize(
      { Fotos: [`data:image/png;base64,${PNG_1X1}`, `data:image/png;base64,${PNG_1X1}`, 'texto'] },
      SCOPE,
    );

    expect(out.Fotos).toEqual([URL, URL, 'texto']);
    expect(storage.upload).toHaveBeenCalledTimes(2);
  });

  it('converts more than one image field in the same submission', async () => {
    const { svc, storage } = make();

    await svc.materialize(
      { Frente: `data:image/png;base64,${PNG_1X1}`, Verso: `data:image/webp;base64,${PNG_1X1}` },
      SCOPE,
    );

    expect(storage.upload).toHaveBeenCalledTimes(2);
    const paths = storage.upload.mock.calls.map((c: unknown[]) => c[1]);
    expect(new Set(paths).size).toBe(2); // uuid por arquivo, sem colisão
  });
});

// Antes disso o tipo `image` não tinha validação nenhuma: o switch de
// validateAnswers não tem esse case, então qualquer string entrava.
describe('AnswerImageService validation', () => {
  it('rejects a mime that is not an allowed image', async () => {
    const { svc, storage } = make();

    await expect(
      svc.materialize({ Foto: 'data:application/pdf;base64,JVBERi0=' }, SCOPE),
    ).rejects.toThrow(BadRequestException);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('rejects a non-image data URI smuggled into a text answer', async () => {
    const { svc } = make();

    await expect(
      svc.materialize({ Nome: 'data:text/html;base64,PHNjcmlwdD4=' }, SCOPE),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an empty payload', async () => {
    const { svc } = make();

    await expect(svc.materialize({ Foto: 'data:image/png;base64,' }, SCOPE)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an image above the size limit', async () => {
    const { svc, storage } = make();
    const tooBig = Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64');

    await expect(
      svc.materialize({ Foto: `data:image/png;base64,${tooBig}` }, SCOPE),
    ).rejects.toThrow(/tamanho máximo/);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('names the offending field in the error', async () => {
    const { svc } = make();

    await expect(
      svc.materialize({ 'Coloque sua melhor foto': 'data:image/gif;base64,R0lGOD' }, SCOPE),
    ).rejects.toThrow(/Coloque sua melhor foto/);
  });

  // Inscrição sem a foto é dado quebrado que ninguém percebe: falhar é melhor.
  it('propagates a storage failure instead of saving without the image', async () => {
    const { svc } = make(jest.fn().mockRejectedValue(new Error('Storage upload failed: boom')));

    await expect(
      svc.materialize({ Foto: `data:image/png;base64,${PNG_1X1}` }, SCOPE),
    ).rejects.toThrow('Storage upload failed: boom');
  });
});
