import { OwnershipGuard } from '@shared/guards/ownership.guard';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser } from '@shared/authenticated-user.entity';
import { EventRepositoryPort } from '@modules/events/ports/event-repository.port';

function makeCtx(req: Record<string, unknown>) {
  return { switchToHttp: () => ({ getRequest: () => req }) } as any;
}

function makeGuard(findOwnershipById: jest.Mock) {
  const eventRepo = { findOwnershipById } as unknown as EventRepositoryPort;
  return { guard: new OwnershipGuard(eventRepo), findOwnershipById };
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
    const { guard, findOwnershipById } = makeGuard(jest.fn());
    const result = await guard.canActivate(makeCtx({ user, params: {} }));
    expect(result).toBe(true);
    expect(findOwnershipById).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when event does not exist', async () => {
    const { guard } = makeGuard(jest.fn().mockResolvedValue(null));
    await expect(guard.canActivate(makeCtx({ user, params: { id: 'e1' } }))).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns true when user is the owner', async () => {
    const findOwnershipById = jest
      .fn()
      .mockResolvedValue({ ownerId: 'user-1', isCollaborator: false });
    const { guard } = makeGuard(findOwnershipById);
    const result = await guard.canActivate(makeCtx({ user, params: { id: 'e1' } }));
    expect(result).toBe(true);
    expect(findOwnershipById).toHaveBeenCalledWith('e1', 'user-1');
  });

  it('returns true when user is a collaborator (not owner)', async () => {
    const findOwnershipById = jest
      .fn()
      .mockResolvedValue({ ownerId: 'someone-else', isCollaborator: true });
    const { guard } = makeGuard(findOwnershipById);
    const result = await guard.canActivate(makeCtx({ user, params: { id: 'e1' } }));
    expect(result).toBe(true);
  });

  it('throws ForbiddenException when user is neither owner nor collaborator', async () => {
    const findOwnershipById = jest
      .fn()
      .mockResolvedValue({ ownerId: 'someone-else', isCollaborator: false });
    const { guard } = makeGuard(findOwnershipById);
    await expect(guard.canActivate(makeCtx({ user, params: { id: 'e1' } }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('resolves eventId from params.eventId as well as params.id', async () => {
    const findOwnershipById = jest
      .fn()
      .mockResolvedValue({ ownerId: 'user-1', isCollaborator: false });
    const { guard } = makeGuard(findOwnershipById);
    await guard.canActivate(makeCtx({ user, params: { eventId: 'e9' } }));
    expect(findOwnershipById).toHaveBeenCalledWith('e9', 'user-1');
  });
});
