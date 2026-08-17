import { Injectable } from '@nestjs/common';
import { PrismaRepositoryBase } from '@infra/repositories/shared/prisma-repository.base';
import { CollaboratorEntity } from '@domain/collaborator_module/collaborator.entity';
import { EventRole } from '@domain/collaborator_module/event-role.type';
import {
  CollaboratorRepositoryPort,
  CollaboratorWithProfile,
} from '@domain/collaborator_module/i-repository-collaborator';

@Injectable()
export class PrismaCollaboratorRepository
  extends PrismaRepositoryBase
  implements CollaboratorRepositoryPort
{
  private toEntity(row: {
    id: string;
    eventId: string;
    profileId: string;
    createdAt: Date;
    role: string;
  }): CollaboratorEntity {
    return new CollaboratorEntity(
      row.id,
      row.eventId,
      row.profileId,
      row.createdAt,
      row.role as EventRole,
    );
  }

  list(eventId: string): Promise<CollaboratorWithProfile[]> {
    return this.prisma.eventCollaborator.findMany({
      where: { eventId },
      include: {
        profile: { select: { id: true, name: true, email: true, photoUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async isCollaborator(eventId: string, profileId: string): Promise<boolean> {
    const count = await this.prisma.eventCollaborator.count({
      where: { eventId, profileId },
    });
    return count > 0;
  }

  // Upsert on the (eventId, profileId) unique → idempotent: re-adding never
  // errors, e o papel informado vale como atualização.
  async upsert(
    eventId: string,
    profileId: string,
    role: EventRole,
  ): Promise<CollaboratorEntity> {
    const row = await this.prisma.eventCollaborator.upsert({
      where: { eventId_profileId: { eventId, profileId } },
      create: { eventId, profileId, role },
      update: { role },
    });
    return this.toEntity(row);
  }

  async updateRole(
    eventId: string,
    profileId: string,
    role: EventRole,
  ): Promise<CollaboratorEntity | null> {
    const { count } = await this.prisma.eventCollaborator.updateMany({
      where: { eventId, profileId },
      data: { role },
    });
    if (count === 0) return null;
    const row = await this.prisma.eventCollaborator.findFirst({
      where: { eventId, profileId },
    });
    return row ? this.toEntity(row) : null;
  }

  async remove(eventId: string, profileId: string): Promise<number> {
    const { count } = await this.prisma.eventCollaborator.deleteMany({
      where: { eventId, profileId },
    });
    return count;
  }
}
