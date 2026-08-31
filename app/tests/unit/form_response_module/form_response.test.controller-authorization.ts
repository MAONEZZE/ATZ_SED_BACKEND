import { Reflector } from '@nestjs/core';
import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { FormResponseController } from '@api/controllers/form_response_module/form-response.controller';
import { AuthenticatedUser } from '@domain/shared/authenticated-user.entity';
import { EventRepositoryPort } from '@domain/event_module/i-repository-event';

const user = new AuthenticatedUser('user-1', 'a@b.com');

/**
 * Guard real + Reflector real apontados para o handler real do DELETE: o que
 * está sob teste é o papel mínimo que essa rota exige. Sem `@RequireEventRole`
 * ela deriva do verbo (escrita = `invited`) — as mesmas permissões do DELETE de
 * registrations. Se alguém decorar a rota com um papel mais frouxo, cai aqui.
 */
function makeCtx(role: string | null, handler: (...args: never[]) => unknown) {
  const eventRepo = {
    findOwnershipById: jest
      .fn()
      .mockResolvedValue(
        role === undefined ? null : { ownerId: 'outro', isCollaborator: role !== null, role },
      ),
  } as unknown as EventRepositoryPort;
  const guard = new OwnershipGuard(eventRepo, new Reflector());
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => ({ user, params: { eventId: 'evt-1' }, method: 'DELETE' }),
    }),
    getHandler: () => handler,
    getClass: () => FormResponseController,
  } as unknown as ExecutionContext;
  return { guard, ctx };
}

// Referência crua ao handler (não uma cópia ligada): é dela que o Reflector lê
// a metadata da rota.
// eslint-disable-next-line @typescript-eslint/unbound-method
const del = FormResponseController.prototype.deleteMany;

describe('DELETE /events/:eventId/form-responses — autorização', () => {
  it('403 para colaborador com papel apenas de leitura', async () => {
    const { guard, ctx } = makeCtx('read', del);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('403 para usuário sem papel nenhum no evento', async () => {
    const { guard, ctx } = makeCtx(null, del);
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('libera colaborador invited (mesmo mínimo do delete de inscrições)', async () => {
    const { guard, ctx } = makeCtx('invited', del);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('libera admin', async () => {
    const { guard, ctx } = makeCtx('admin', del);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('404 quando o evento não existe', async () => {
    const eventRepo = {
      findOwnershipById: jest.fn().mockResolvedValue(null),
    } as unknown as EventRepositoryPort;
    const guard = new OwnershipGuard(eventRepo, new Reflector());
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user, params: { eventId: 'nao-existe' }, method: 'DELETE' }),
      }),
      getHandler: () => del,
      getClass: () => FormResponseController,
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  it('401 sem usuário autenticado na request', async () => {
    const guard = new OwnershipGuard({} as EventRepositoryPort, new Reflector());
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ params: { eventId: 'evt-1' }, method: 'DELETE' }),
      }),
      getHandler: () => del,
      getClass: () => FormResponseController,
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
