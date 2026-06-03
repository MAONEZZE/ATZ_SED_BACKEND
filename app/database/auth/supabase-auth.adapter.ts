import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as jwt from 'jsonwebtoken';
import { AuthPort } from '@domain/users/ports/auth.port';
import {
  AuthenticatedUser,
  UserRole,
} from '@domain/users/entities/authenticated-user.entity';

@Injectable()
export class SupabaseAuthAdapter implements AuthPort {
  private readonly supabase: SupabaseClient;
  private readonly jwtSecret: string;

  constructor(config: ConfigService) {
    this.supabase = createClient(
      config.get<string>('SUPABASE_URL')!,
      config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    this.jwtSecret = config.get<string>('SUPABASE_JWT_SECRET')!;
  }

  async verifyToken(token: string): Promise<AuthenticatedUser> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as jwt.JwtPayload;
      const userId = payload.sub!;
      const role = ((payload['user_metadata'] as Record<string, unknown>)?.['role'] ??
        'organizer') as UserRole;
      const email = payload['email'] as string;
      return new AuthenticatedUser(userId, email, role);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async getUser(id: string): Promise<AuthenticatedUser | null> {
    const { data, error } = await this.supabase.auth.admin.getUserById(id);
    if (error || !data.user) return null;
    const role = ((data.user.user_metadata as Record<string, unknown>)?.['role'] ??
      'organizer') as UserRole;
    return new AuthenticatedUser(id, data.user.email!, role);
  }
}
