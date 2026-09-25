import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StorageObject, StoragePort, UploadResult } from '@domain/shared/i-storage';

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

  async move(bucket: string, fromPath: string, toPath: string): Promise<void> {
    const { error } = await this.client.storage.from(bucket).move(fromPath, toPath);
    if (error) throw new Error(`Storage move failed: ${error.message}`);
  }

  async list(bucket: string, prefix: string): Promise<StorageObject[]> {
    const objects: StorageObject[] = [];
    const pending = [prefix.replace(/\/$/, '')];
    while (pending.length) {
      const folder = pending.pop()!;
      let offset = 0;
      for (;;) {
        const { data, error } = await this.client.storage
          .from(bucket)
          .list(folder, { limit: 1000, offset });
        if (error) throw new Error(`Storage list failed: ${error.message}`);
        for (const item of data ?? []) {
          const path = `${folder}/${item.name}`;
          if (item.id === null) {
            pending.push(path);
          } else {
            objects.push({
              path,
              updatedAt: new Date(item.updated_at ?? item.created_at ?? 0),
            });
          }
        }
        if (!data || data.length < 1000) break;
        offset += data.length;
      }
    }
    return objects;
  }

  getPublicUrl(bucket: string, path: string): string {
    const { data } = this.client.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }
}
