import {
  Injectable,
  Inject,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  EVENT_REPOSITORY_PORT,
  EventRepositoryPort,
} from '@modules/events/ports/event-repository.port';
import { AuthenticatedUser } from '@api/controllers/shared/authenticated-user.entity';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(@Inject(EVENT_REPOSITORY_PORT) private readonly eventRepo: EventRepositoryPort) {}

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
    const isOwner = ownership.ownerId === user.id;
    if (!isOwner && !ownership.isCollaborator) throw new ForbiddenException('Not your event');
    return true;
  }
}
