import { OwnershipGuard } from '@shared/guards/ownership.guard';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser } from '@shared/authenticated-user.entity';

function makeCtx(req: Record<string, unknown>) {
  return { switchToHttp: () => ({ getRequest: () => req }) } as any;
}

function makeGuard(findUnique?: jest.Mock) {
  const prisma = { event: findUnique ? { findUnique } : undefined } as any;
  return { guard: new OwnershipGuard(prisma), findUnique };
}

const user = new AuthenticatedUser('user-1', 'a@b.com');

describe('OwnershipGuard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws UnauthorizedException when no user on request', async () => {
    const { guard } = makeGuard(jest.fn());
    await expect(guard.canActivate(makeCtx({ params: { id: 'e1' } }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('returns true when no eventId param present', async () => {
    const { guard, findUnique } = makeGuard(jest.fn());
    const result = await guard.canActivate(makeCtx({ user, params: {} }));
    expect(result).toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('returns true (skips check) when prisma event model unavailable', async () => {
    const { guard } = makeGuard(undefined);
    const result = await guard.canActivate(makeCtx({ user, params: { id: 'e1' } }));
    expect(result).toBe(true);
  });

  it('throws NotFoundException when event does not exist', async () => {
    const { guard } = makeGuard(jest.fn().mockResolvedValue(null));
    await expect(guard.canActivate(makeCtx({ user, params: { id: 'e1' } }))).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns true when user is the owner', async () => {
    const findUnique = jest.fn().mockResolvedValue({ ownerId: 'user-1', collaborators: [] });
    const { guard } = makeGuard(findUnique);
    const result = await guard.canActivate(makeCtx({ user, params: { id: 'e1' } }));
    expect(result).toBe(true);
    // select must scope collaborators to the current user's profileId
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'e1' },
        select: expect.objectContaining({
          ownerId: true,
          collaborators: expect.objectContaining({ where: { profileId: 'user-1' } }),
        }),
      }),
    );
  });

  it('returns true when user is a collaborator (not owner)', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValue({ ownerId: 'someone-else', collaborators: [{ id: 'c1' }] });
    const { guard } = makeGuard(findUnique);
    const result = await guard.canActivate(makeCtx({ user, params: { id: 'e1' } }));
    expect(result).toBe(true);
  });

  it('throws ForbiddenException when user is neither owner nor collaborator', async () => {
    const findUnique = jest.fn().mockResolvedValue({ ownerId: 'someone-else', collaborators: [] });
    const { guard } = makeGuard(findUnique);
    await expect(guard.canActivate(makeCtx({ user, params: { id: 'e1' } }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('resolves eventId from params.eventId as well as params.id', async () => {
    const findUnique = jest.fn().mockResolvedValue({ ownerId: 'user-1', collaborators: [] });
    const { guard } = makeGuard(findUnique);
    await guard.canActivate(makeCtx({ user, params: { eventId: 'e9' } }));
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'e9' } }));
  });
});
