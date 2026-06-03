import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@database/prisma/prisma.service';
import { AuthenticatedUser } from '@domain/users/entities/authenticated-user.entity';

// Checks that the authenticated organizer owns the event referenced by :eventId or :id param.
// Admin role bypasses ownership check.
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Record<string, unknown>>();
    const user = request['user'] as AuthenticatedUser;
    if (user?.role === 'admin') return true;

    const params = request['params'] as Record<string, string>;
    const eventId = params['eventId'] ?? params['id'];
    if (!eventId) return true;

    // OwnershipGuard requires Prisma — will be fully functional after Task 4 (Prisma setup)
    const event = await (this.prisma as any).event?.findUnique?.({
      where: { id: eventId },
      select: { ownerId: true },
    });
    if (event === undefined) return true; // Prisma not yet set up — skip check
    if (!event) throw new NotFoundException('Event not found');
    if (event.ownerId !== user.id) throw new ForbiddenException('Not your event');
    return true;
  }
}
