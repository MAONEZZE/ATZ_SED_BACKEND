import { RolesGuard } from '@api/config/guards/roles.guard';
import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '@domain/users/entities/authenticated-user.entity';

const mockReflector = { getAllAndOverride: jest.fn() };
const guard = new RolesGuard(mockReflector as any);

const makeCtx = (user: AuthenticatedUser) => ({
  getHandler: () => ({}),
  getClass: () => ({}),
  switchToHttp: () => ({ getRequest: () => ({ user }) }),
} as any);

describe('RolesGuard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('allows access when no roles required', () => {
    mockReflector.getAllAndOverride.mockReturnValue([]);
    expect(guard.canActivate(makeCtx(new AuthenticatedUser('1', 'a@b.com', 'organizer')))).toBe(true);
  });

  it('allows access when user has required role', () => {
    mockReflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(guard.canActivate(makeCtx(new AuthenticatedUser('1', 'a@b.com', 'admin')))).toBe(true);
  });

  it('throws ForbiddenException when user lacks required role', () => {
    mockReflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(() =>
      guard.canActivate(makeCtx(new AuthenticatedUser('1', 'a@b.com', 'organizer'))),
    ).toThrow(ForbiddenException);
  });
});
