import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser } from '@shared/authenticated-user.entity';

const mockAuth = {
  verifyToken: jest.fn(),
  getUser: jest.fn(),
};

const guard = new JwtAuthGuard(mockAuth);

const makeCtx = (authHeader?: string) => {
  const req: Record<string, unknown> = { headers: { authorization: authHeader } };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
};

describe('JwtAuthGuard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws UnauthorizedException when Authorization header is missing', async () => {
    await expect(guard.canActivate(makeCtx())).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when header is not Bearer', async () => {
    await expect(guard.canActivate(makeCtx('Basic abc123'))).rejects.toThrow(UnauthorizedException);
  });

  it('attaches user to request and returns true on valid token', async () => {
    const user = new AuthenticatedUser('u1', 'a@b.com');
    mockAuth.verifyToken.mockResolvedValue(user);
    const req: Record<string, unknown> = {
      headers: { authorization: 'Bearer valid-token' },
    };
    const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as any;
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(req['user']).toBe(user);
  });

  it('propagates error from auth.verifyToken', async () => {
    mockAuth.verifyToken.mockRejectedValue(new UnauthorizedException('bad token'));
    await expect(guard.canActivate(makeCtx('Bearer bad'))).rejects.toThrow(UnauthorizedException);
  });
});
