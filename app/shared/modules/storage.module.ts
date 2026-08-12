import { Module } from '@nestjs/common';
import { STORAGE_PORT } from '@domain/shared/i-storage';
import { SupabaseStorageAdapter } from '@infra/adapters/supabase-storage.adapter';

@Module({
  providers: [{ provide: STORAGE_PORT, useClass: SupabaseStorageAdapter }],
  exports: [STORAGE_PORT],
})
export class StorageModule {}
