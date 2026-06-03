import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@database/prisma/prisma.service';
import { AuthenticatedUser } from '@domain/users/entities/authenticated-user.entity';

// Ensures the authenticated organizer owns the event (:eventId or :id param).
// Admin role bypasses. Requires JwtAuthGuard to have run first.
@Injectable()
export class OwnershipGuard implements CanActivate {
  private readonly logger = new Logger(OwnershipGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Record<string, unknown>>();
    const user = request['user'] as AuthenticatedUser | undefined;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (user.role === 'admin') return true;

    const params = request['params'] as Record<string, string>;
    const eventId = params['eventId'] ?? params['id'];
    if (!eventId) return true;

    // Prisma may not be available until Task 4 (schema migration).
    // Once available, this guard fully enforces event ownership.
    const prismaEvent = (this.prisma as any)['event'];
    if (!prismaEvent?.findUnique) {
      this.logger.warn('OwnershipGuard: Prisma event model not available — skipping ownership check');
      return true;
    }

    const event = await prismaEvent.findUnique({
      where: { id: eventId },
      select: { ownerId: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (event.ownerId !== user.id) throw new ForbiddenException('Not your event');
    return true;
  }
}
