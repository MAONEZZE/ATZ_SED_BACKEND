import {
  Injectable,
  Inject,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  EVENT_REPOSITORY_PORT,
  EventRepositoryPort,
} from '@domain/event_module/i-repository-event';
import { AuthenticatedUser } from '@domain/shared/authenticated-user.entity';
import { EventRole, roleAtLeast } from '@domain/collaborator_module/event-role.type';
import { EVENT_ROLE_KEY } from '@api/config/decorators/require-event-role.decorator';

/**
 * Acesso ao evento por papel (read < invited < admin). O dono é admin implícito.
 *
 * O mínimo exigido vem do `@RequireEventRole(...)` da rota; sem ele, deriva do
 * verbo: GET/HEAD exige `read`, qualquer escrita exige `invited`. Assim `read`
 * fica travado em toda rota de escrita de evento sem precisar decorar as ~10
 * controllers uma por uma.
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    @Inject(EVENT_REPOSITORY_PORT) private readonly eventRepo: EventRepositoryPort,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    const user = request['user'] as AuthenticatedUser | undefined;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const params = request['params'] as Record<string, string>;
    const eventId = params['eventId'] ?? params['id'];
    if (!eventId) return true;

    const ownership = await this.eventRepo.findOwnershipById(eventId, user.id);
    if (!ownership) throw new NotFoundException('Event not found');
    if (!ownership.role) throw new ForbiddenException('Not your event');

    const required = this.requiredRole(context, request);
    if (!roleAtLeast(ownership.role, required)) {
      throw new ForbiddenException(`This action requires the '${required}' role on the event`);
    }
    // O papel resolvido fica na request para o @CurrentEventRole devolvê-lo ao
    // handler (ex.: `myRole` no GET do evento) sem uma segunda consulta.
    request['eventRole'] = ownership.role;
    return true;
  }

  private requiredRole(context: ExecutionContext, request: Record<string, unknown>): EventRole {
    const declared = this.reflector.getAllAndOverride<EventRole | undefined>(EVENT_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (declared) return declared;
    const method = String(request['method'] ?? 'GET').toUpperCase();
    return method === 'GET' || method === 'HEAD' ? 'read' : 'invited';
  }
}
