export type UserRole = 'admin' | 'organizer';

export class AuthenticatedUser {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly role: UserRole,
  ) {}
}
