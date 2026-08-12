import { Module } from '@nestjs/common';
import { AUTH_PORT } from '@domain/shared/i-auth';
import { SupabaseAuthAdapter } from '@infra/adapters/supabase-auth.adapter';

@Module({
  providers: [{ provide: AUTH_PORT, useClass: SupabaseAuthAdapter }],
  exports: [AUTH_PORT],
})
export class AuthModule {}
