import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { AUTH_PORT, AuthPort } from '@infra/auth/auth.port';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(AUTH_PORT) private readonly auth: AuthPort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }
    const token = authHeader.slice(7);
    const user = await this.auth.verifyToken(token);
    (request as unknown as Record<string, unknown>)['user'] = user;
    return true;
  }
}
