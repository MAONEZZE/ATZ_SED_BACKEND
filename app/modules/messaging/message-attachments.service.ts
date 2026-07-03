import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { STORAGE_PORT, StoragePort } from '@infra/storage/storage.port';

export interface UploadedAttachment {
  path: string;
  filename: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class MessageAttachmentsService {
  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly config: ConfigService,
  ) {}

  async upload(
    userId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  ): Promise<UploadedAttachment> {
    const bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'ATZ_SED';
    const folder =
      this.config.get<string>('SUPABASE_STORAGE_BUCKET_MESSAGE_ATTACHMENTS') ?? 'message-attachments';
    const safeName = file.originalname.replace(/[^\w.\-]/g, '_');
    const path = `${folder}/${userId}/${randomUUID()}-${safeName}`;
    await this.storage.upload(bucket, path, file.buffer, file.mimetype);
    return { path, filename: file.originalname, mimetype: file.mimetype, size: file.size };
  }
}
