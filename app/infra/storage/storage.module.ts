import { Module } from '@nestjs/common';
import { STORAGE_PORT } from '@infra/storage/storage.port';
import { SupabaseStorageAdapter } from './supabase-storage.adapter';

@Module({
  providers: [{ provide: STORAGE_PORT, useClass: SupabaseStorageAdapter }],
  exports: [STORAGE_PORT],
})
export class StorageModule {}
