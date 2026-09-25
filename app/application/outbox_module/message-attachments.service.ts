import { BadRequestException, Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { STORAGE_PORT, StoragePort } from '@domain/shared/i-storage';
import {
  MESSAGE_TEMPLATE_REPOSITORY_PORT,
  MessageTemplateRepositoryPort,
} from '@domain/message_template_module/i-repository-message-template';
import { StoredAttachment } from '@domain/shared/file-reference';

export interface UploadedAttachment {
  path: string;
  filename: string;
  mimetype: string;
  size: number;
}

const TEMPLATE_IMAGE_AND_PDF_LIMIT = 30 * 1024 * 1024;
const TEMPLATE_VIDEO_LIMIT = 60 * 1024 * 1024;
const TEMPLATE_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
]);

@Injectable()
export class MessageAttachmentsService {
  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly config: ConfigService,
    @Inject(MESSAGE_TEMPLATE_REPOSITORY_PORT)
    private readonly templates: MessageTemplateRepositoryPort,
  ) {}

  async upload(
    userId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  ): Promise<UploadedAttachment> {
    const bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'ATZ_SED';
    const folder =
      this.config.get<string>('SUPABASE_STORAGE_BUCKET_MESSAGE_ATTACHMENTS') ??
      'message-attachments';
    const safeName = file.originalname.replace(/[^\w.-]/g, '_').replace(/\.{2,}/g, '.');
    const path = `${folder}/${userId}/${randomUUID()}-${safeName}`;
    await this.storage.upload(bucket, path, file.buffer, file.mimetype);
    return { path, filename: file.originalname, mimetype: file.mimetype, size: file.size };
  }

  async uploadTemplate(
    userId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  ): Promise<StoredAttachment> {
    this.assertTemplateFile(file.mimetype, file.size);
    const uploaded = await this.upload(userId, file);
    return {
      path: uploaded.path,
      name: uploaded.filename,
      mimetype: uploaded.mimetype,
      size: uploaded.size,
    };
  }

  assertOwned(userId: string, attachment: StoredAttachment): void {
    const folder =
      this.config.get<string>('SUPABASE_STORAGE_BUCKET_MESSAGE_ATTACHMENTS') ??
      'message-attachments';
    if (!attachment.path.startsWith(`${folder}/${userId}/`) || attachment.path.includes('..')) {
      throw new BadRequestException('Attachment path does not belong to the template owner');
    }
    this.assertTemplateFile(attachment.mimetype, attachment.size);
  }

  private assertTemplateFile(mimetype: string, size: number): void {
    if (!TEMPLATE_MIMES.has(mimetype)) {
      throw new BadRequestException('Template aceita PDF, JPEG, PNG, WebP ou vídeo MP4');
    }
    const limit = mimetype === 'video/mp4' ? TEMPLATE_VIDEO_LIMIT : TEMPLATE_IMAGE_AND_PDF_LIMIT;
    if (size < 1 || size > limit) {
      throw new BadRequestException(
        `Anexo excede o limite de ${Math.floor(limit / 1024 / 1024)} MB`,
      );
    }
  }

  async deleteIfUnreferenced(path: string): Promise<void> {
    if (await this.templates.isAttachmentPathReferenced(path)) return;
    const bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'ATZ_SED';
    await this.storage.delete(bucket, path);
  }
}
