import { Injectable } from '@nestjs/common';
import { PrismaRepositoryBase } from '@shared/prisma-repository.base';

@Injectable()
export class CollaboratorsRepository extends PrismaRepositoryBase {
  list(eventId: string) {
    return this.prisma.eventCollaborator.findMany({
      where: { eventId },
      include: {
        profile: { select: { id: true, name: true, email: true, photoUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async isCollaborator(eventId: string, profileId: string): Promise<boolean> {
    const count = await this.prisma.eventCollaborator.count({ where: { eventId, profileId } });
    return count > 0;
  }

  // Upsert on the (eventId, profileId) unique → idempotent: re-adding never errors.
  upsert(eventId: string, profileId: string) {
    return this.prisma.eventCollaborator.upsert({
      where: { eventId_profileId: { eventId, profileId } },
      create: { eventId, profileId },
      update: {},
    });
  }

  async remove(eventId: string, profileId: string): Promise<number> {
    const { count } = await this.prisma.eventCollaborator.deleteMany({
      where: { eventId, profileId },
    });
    return count;
  }
}
