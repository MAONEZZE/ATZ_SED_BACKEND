import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { EventRole } from '@domain/collaborator_module/event-role.type';

/**
 * Papel do usuário logado no evento da rota, já resolvido pelo OwnershipGuard
 * (que o buscou no banco por eventId + id do JWT). Só funciona em rota guardada
 * pelo OwnershipGuard — sem ele não há papel algum na request.
 */
export const CurrentEventRole = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): EventRole => {
    const request = ctx.switchToHttp().getRequest<Record<string, unknown>>();
    return request['eventRole'] as EventRole;
  },
);
