import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser } from '@domain/shared/authenticated-user.entity';
import { EventRepositoryPort } from '@domain/event_module/i-repository-event';

function makeCtx(req: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method: 'GET', ...req }) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as any;
}

function makeGuard(findOwnershipById: jest.Mock, declaredRole?: string) {
  const eventRepo = { findOwnershipById } as unknown as EventRepositoryPort;
  // Reflector devolve o papel mínimo do @RequireEventRole; undefined = sem decorator.
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(declaredRole) } as any;
  return { guard: new OwnershipGuard(eventRepo, reflector), findOwnershipById };
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
      .mockResolvedValue({ ownerId: 'user-1', isCollaborator: false, role: 'admin' });
    const { guard } = makeGuard(findOwnershipById);
    const result = await guard.canActivate(makeCtx({ user, params: { id: 'e1' } }));
    expect(result).toBe(true);
    expect(findOwnershipById).toHaveBeenCalledWith('e1', 'user-1');
  });

  it('returns true when user is a collaborator (not owner)', async () => {
    const findOwnershipById = jest
      .fn()
      .mockResolvedValue({ ownerId: 'someone-else', isCollaborator: true, role: 'invited' });
    const { guard } = makeGuard(findOwnershipById);
    const result = await guard.canActivate(makeCtx({ user, params: { id: 'e1' } }));
    expect(result).toBe(true);
  });

  it('throws ForbiddenException when user is neither owner nor collaborator', async () => {
    const findOwnershipById = jest
      .fn()
      .mockResolvedValue({ ownerId: 'someone-else', isCollaborator: false, role: null });
    const { guard } = makeGuard(findOwnershipById);
    await expect(guard.canActivate(makeCtx({ user, params: { id: 'e1' } }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('resolves eventId from params.eventId as well as params.id', async () => {
    const findOwnershipById = jest
      .fn()
      .mockResolvedValue({ ownerId: 'user-1', isCollaborator: false, role: 'admin' });
    const { guard } = makeGuard(findOwnershipById);
    await guard.canActivate(makeCtx({ user, params: { eventId: 'e9' } }));
    expect(findOwnershipById).toHaveBeenCalledWith('e9', 'user-1');
  });
});

// Papel mínimo: sem @RequireEventRole o guard deriva do verbo — GET exige
// `read`, escrita exige `invited`. Assim `read` fica travado em toda rota de
// escrita sem decorar as ~10 controllers de evento uma por uma.
describe('OwnershipGuard — papel mínimo por rota', () => {
  const ownershipWith = (role: string | null) =>
    jest.fn().mockResolvedValue({ ownerId: 'someone-else', isCollaborator: role !== null, role });

  it('lets read through on a GET', async () => {
    const { guard } = makeGuard(ownershipWith('read'));
    await expect(
      guard.canActivate(makeCtx({ user, params: { id: 'e1' }, method: 'GET' })),
    ).resolves.toBe(true);
  });

  it('blocks read on a write', async () => {
    const { guard } = makeGuard(ownershipWith('read'));
    await expect(
      guard.canActivate(makeCtx({ user, params: { id: 'e1' }, method: 'PATCH' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lets invited write', async () => {
    const { guard } = makeGuard(ownershipWith('invited'));
    await expect(
      guard.canActivate(makeCtx({ user, params: { id: 'e1' }, method: 'POST' })),
    ).resolves.toBe(true);
  });

  it('blocks invited on an admin-only route', async () => {
    const { guard } = makeGuard(ownershipWith('invited'), 'admin');
    await expect(
      guard.canActivate(makeCtx({ user, params: { eventId: 'e1' }, method: 'POST' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lets admin through on an admin-only route', async () => {
    const { guard } = makeGuard(ownershipWith('admin'), 'admin');
    await expect(
      guard.canActivate(makeCtx({ user, params: { eventId: 'e1' }, method: 'DELETE' })),
    ).resolves.toBe(true);
  });

  // DELETE do evento é declarado com mínimo `read`: para invited/read ele
  // desvincula em vez de apagar, então o guard não pode barrar pelo verbo.
  it('lets read through on a route declared as read even being a DELETE', async () => {
    const { guard } = makeGuard(ownershipWith('read'), 'read');
    await expect(
      guard.canActivate(makeCtx({ user, params: { id: 'e1' }, method: 'DELETE' })),
    ).resolves.toBe(true);
  });

  it('still 403s someone with no role at all', async () => {
    const { guard } = makeGuard(ownershipWith(null), 'read');
    await expect(
      guard.canActivate(makeCtx({ user, params: { id: 'e1' }, method: 'GET' })),
    ).rejects.toThrow(ForbiddenException);
  });
});
