import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as ws from 'ws';
import { AuthPort } from '@domain/users/ports/auth.port';
import { AuthenticatedUser } from '@domain/users/entities/authenticated-user.entity';

@Injectable()
export class SupabaseAuthAdapter implements AuthPort {
  private readonly supabase: SupabaseClient;

  constructor(config: ConfigService) {
    this.supabase = createClient(
      config.get<string>('SUPABASE_URL')!,
      config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
      { realtime: { transport: ws as any } },
    );
  }

  async verifyToken(token: string): Promise<AuthenticatedUser> {
    // Valida via API do Supabase — independe do algoritmo de assinatura
    // (projetos novos emitem ES256; jwt.verify local com HS256 quebrava).
    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return new AuthenticatedUser(data.user.id, data.user.email ?? '');
  }

  async getUser(id: string): Promise<AuthenticatedUser | null> {
    const { data, error } = await this.supabase.auth.admin.getUserById(id);
    if (error || !data.user) return null;
    return new AuthenticatedUser(id, data.user.email ?? '');
  }
}
