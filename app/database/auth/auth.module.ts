import { Module } from '@nestjs/common';
import { AUTH_PORT } from '@domain/users/ports/auth.port';
import { SupabaseAuthAdapter } from './supabase-auth.adapter';

@Module({
  providers: [{ provide: AUTH_PORT, useClass: SupabaseAuthAdapter }],
  exports: [AUTH_PORT],
})
export class AuthModule {}
