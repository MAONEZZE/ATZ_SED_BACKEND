export class AuthenticatedUser {
  constructor(
    public readonly id: string,
    public readonly email: string,
  ) {}
}
