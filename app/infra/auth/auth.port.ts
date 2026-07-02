import { AuthenticatedUser } from '@shared/authenticated-user.entity';

export const AUTH_PORT = Symbol('AUTH_PORT');

export interface AuthPort {
  verifyToken(jwt: string): Promise<AuthenticatedUser>;
  getUser(id: string): Promise<AuthenticatedUser | null>;
}
