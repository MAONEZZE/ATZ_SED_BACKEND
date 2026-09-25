import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { STORAGE_PORT, StoragePort } from '@domain/shared/i-storage';
import { FORM_REPOSITORY_PORT, FormRepositoryPort } from '@domain/form_module/i-repository-form';
import {
  FORM_FIELD_REPOSITORY_PORT,
  FormFieldRepositoryPort,
} from '@domain/form_field_module/i-repository-form-field';
import {
  EVENT_REPOSITORY_PORT,
  EventRepositoryPort,
} from '@domain/event_module/i-repository-event';
import { FileReference } from '@domain/shared/file-reference';
import {
  AnswerFieldMeta,
  rejectDataUris,
  resolveFieldAnswer,
} from '@domain/shared/answer-validation';

const TEN_MB = 10 * 1024 * 1024;
const FIFTY_MB = 50 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/csv': 'csv',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/rtf': 'rtf',
  'text/rtf': 'rtf',
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

type UploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Injectable()
export class FormDocumentsService {
  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly config: ConfigService,
    @Inject(FORM_REPOSITORY_PORT) private readonly forms: FormRepositoryPort,
    @Inject(FORM_FIELD_REPOSITORY_PORT)
    private readonly fields: FormFieldRepositoryPort,
    @Inject(EVENT_REPOSITORY_PORT) private readonly events: EventRepositoryPort,
  ) {}

  async uploadTemporary(formId: string, fieldId: string, file: UploadFile): Promise<FileReference> {
    const form = await this.forms.findById(formId);
    if (!form) throw new NotFoundException('Form not found');
    const event = await this.events.findById(form.eventId);
    if (!event || (event.status !== 'published' && event.status !== 'ended')) {
      throw new BadRequestException('Event is not accepting form responses');
    }
    await this.assertDocumentField(formId, fieldId);
    return this.upload(file, `${this.uploadFolder()}/tmp/${formId}`);
  }

  async uploadFinal(
    eventId: string,
    formId: string,
    fieldId: string,
    file: UploadFile,
  ): Promise<FileReference> {
    const form = await this.forms.findById(formId);
    if (!form || form.eventId !== eventId) throw new NotFoundException('Form not found');
    await this.assertDocumentField(formId, fieldId);
    return this.upload(file, `${this.uploadFolder()}/${eventId}/${formId}`);
  }

  async finalizeAnswers(
    answers: Record<string, unknown>,
    fields: AnswerFieldMeta[],
    scope: { eventId: string; formId: string },
  ): Promise<Record<string, unknown>> {
    rejectDataUris(answers);
    const result = { ...answers };
    const promoted = new Map<string, FileReference>();

    for (const field of fields.filter((item) => item.type === 'document')) {
      const value = resolveFieldAnswer(answers, field);
      if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
        continue;
      }
      if (!Array.isArray(value)) {
        throw new BadRequestException(`Campo "${field.label}" deve conter uma lista de arquivos`);
      }
      const files: FileReference[] = [];
      for (const raw of value) {
        const file = raw as FileReference;
        const cached = promoted.get(file.url);
        if (cached) {
          files.push(cached);
          continue;
        }
        const finalized = await this.finalizeFile(file, scope);
        promoted.set(file.url, finalized);
        files.push(finalized);
      }
      const submittedKey = Object.prototype.hasOwnProperty.call(answers, field.id)
        ? field.id
        : Object.keys(answers).find(
            (key) => key.trim().toLowerCase() === field.label.trim().toLowerCase(),
          );
      if (submittedKey) result[submittedKey] = files;
    }
    return result;
  }

  async deleteTemporaryOlderThan(cutoff: Date): Promise<number> {
    const bucket = this.bucket();
    const files = await this.storage.list(bucket, `${this.uploadFolder()}/tmp`);
    const expired = files.filter((file) => file.updatedAt < cutoff);
    await Promise.all(expired.map((file) => this.storage.delete(bucket, file.path)));
    return expired.length;
  }

  private async assertDocumentField(formId: string, fieldId: string): Promise<void> {
    const field = await this.fields.findByForm(formId, fieldId);
    if (!field || field.type !== 'document') {
      throw new NotFoundException('Document field not found');
    }
  }

  private async upload(file: UploadFile, folder: string): Promise<FileReference> {
    const extension = EXTENSIONS[file.mimetype];
    if (!extension) throw new BadRequestException('Tipo de documento não permitido');
    const limit = file.mimetype.startsWith('video/') ? FIFTY_MB : TEN_MB;
    if (file.size < 1 || file.size > limit) {
      throw new BadRequestException(
        `Arquivo excede o limite de ${Math.floor(limit / 1024 / 1024)} MB`,
      );
    }
    const path = `${folder}/${randomUUID()}.${extension}`;
    const { url } = await this.storage.upload(this.bucket(), path, file.buffer, file.mimetype);
    return { url, name: file.originalname, mimetype: file.mimetype, size: file.size };
  }

  private async finalizeFile(
    file: FileReference,
    scope: { eventId: string; formId: string },
  ): Promise<FileReference> {
    const bucket = this.bucket();
    const temporaryPath = `${this.uploadFolder()}/tmp/${scope.formId}/`;
    const finalPath = `${this.uploadFolder()}/${scope.eventId}/${scope.formId}/`;
    const temporaryUrl = this.storage.getPublicUrl(bucket, temporaryPath);
    const finalUrl = this.storage.getPublicUrl(bucket, finalPath);

    if (file.url.startsWith(finalUrl)) {
      this.assertSingleFileSuffix(file.url.slice(finalUrl.length));
      return file;
    }
    if (!file.url.startsWith(temporaryUrl)) {
      throw new BadRequestException('Documento não pertence a este formulário');
    }
    const suffix = file.url.slice(temporaryUrl.length);
    this.assertSingleFileSuffix(suffix);
    const decodedSuffix = decodeURIComponent(suffix);
    const fromPath = `${temporaryPath}${decodedSuffix}`;
    const toPath = `${finalPath}${decodedSuffix}`;
    await this.storage.move(bucket, fromPath, toPath);
    return { ...file, url: this.storage.getPublicUrl(bucket, toPath) };
  }

  private assertSingleFileSuffix(suffix: string): void {
    if (!suffix || suffix.includes('/') || suffix.includes('..')) {
      throw new BadRequestException('URL de documento inválida');
    }
  }

  private bucket(): string {
    return this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'ATZ_SED';
  }

  private uploadFolder(): string {
    return this.config.get<string>('SUPABASE_STORAGE_BUCKET_UPLOADS') ?? 'registration-uploads';
  }
}
