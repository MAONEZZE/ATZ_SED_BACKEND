import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StoragePort, UploadResult } from '@domain/shared/ports/storage.port';

@Injectable()
export class SupabaseStorageAdapter implements StoragePort {
  private readonly client: SupabaseClient;

  constructor(config: ConfigService) {
    this.client = createClient(
      config.get<string>('SUPABASE_URL')!,
      config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    );
  }

  async upload(
    bucket: string,
    path: string,
    file: Buffer,
    mimeType: string,
  ): Promise<UploadResult> {
    const { error } = await this.client.storage
      .from(bucket)
      .upload(path, file, { contentType: mimeType, upsert: true });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    const { data } = this.client.storage.from(bucket).getPublicUrl(path);
    return { url: data.publicUrl, path };
  }

  async delete(bucket: string, path: string): Promise<void> {
    const { error } = await this.client.storage.from(bucket).remove([path]);
    if (error) throw new Error(`Storage delete failed: ${error.message}`);
  }
}
