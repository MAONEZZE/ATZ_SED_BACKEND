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
      const payload = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
      }) as jwt.JwtPayload;

      if (!payload.sub) {
        throw new UnauthorizedException('Token missing subject claim');
      }

      const userId = payload.sub;
      const email =
        typeof payload['email'] === 'string' ? payload['email'] : '';
      const rawRole = (
        payload['user_metadata'] as Record<string, unknown> | undefined
      )?.['role'];
      const role: UserRole = rawRole === 'admin' ? 'admin' : 'organizer';

      return new AuthenticatedUser(userId, email, role);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async getUser(id: string): Promise<AuthenticatedUser | null> {
    const { data, error } = await this.supabase.auth.admin.getUserById(id);
    if (error || !data.user) return null;
    const rawRole = (
      data.user.user_metadata as Record<string, unknown> | undefined
    )?.['role'];
    const role: UserRole = rawRole === 'admin' ? 'admin' : 'organizer';
    return new AuthenticatedUser(id, data.user.email ?? '', role);
  }
}
