import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@infra/prisma/prisma.service';
import { AuthenticatedUser } from '@shared/authenticated-user.entity';

@Injectable()
export class OwnershipGuard implements CanActivate {
  private readonly logger = new Logger(OwnershipGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    const user = request['user'] as AuthenticatedUser | undefined;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const params = request['params'] as Record<string, string>;
    const eventId = params['eventId'] ?? params['id'];
    if (!eventId) return true;

    const prismaEvent = (this.prisma as any)['event'];
    if (!prismaEvent?.findUnique) {
      this.logger.warn(
        'OwnershipGuard: Prisma event model not available — skipping ownership check',
      );
      return true;
    }

    const event = await prismaEvent.findUnique({
      where: { id: eventId },
      select: {
        ownerId: true,
        collaborators: { where: { profileId: user.id }, select: { id: true }, take: 1 },
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    const isOwner = event.ownerId === user.id;
    const isCollaborator = (event.collaborators?.length ?? 0) > 0;
    if (!isOwner && !isCollaborator) throw new ForbiddenException('Not your event');
    return true;
  }
}
