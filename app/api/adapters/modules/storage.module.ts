import { Module } from '@nestjs/common';
import { STORAGE_PORT } from '@api/adapters/ports/i-storage';
import { SupabaseStorageAdapter } from '../supabase-storage.adapter';

@Module({
  providers: [{ provide: STORAGE_PORT, useClass: SupabaseStorageAdapter }],
  exports: [STORAGE_PORT],
})
export class StorageModule {}
