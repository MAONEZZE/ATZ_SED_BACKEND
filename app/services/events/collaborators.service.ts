import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@database/prisma/prisma.service';

@Injectable()
export class CollaboratorsService {
  constructor(private readonly prisma: PrismaService) {}

  list(eventId: string) {
    return this.prisma.eventCollaborator.findMany({
      where: { eventId },
      include: {
        profile: { select: { id: true, name: true, email: true, photoUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async add(eventId: string, email: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { ownerId: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    const profile = await this.prisma.profile.findFirst({ where: { email } });
    if (!profile) {
      throw new NotFoundException('No registered user with this email. Ask them to sign up first.');
    }
    if (profile.id === event.ownerId) {
      throw new ConflictException('User is already the event owner');
    }

    // Upsert on the (eventId, profileId) unique → idempotent: re-adding never errors.
    return this.prisma.eventCollaborator.upsert({
      where: { eventId_profileId: { eventId, profileId: profile.id } },
      create: { eventId, profileId: profile.id },
      update: {},
    });
  }

  async remove(eventId: string, profileId: string): Promise<void> {
    const { count } = await this.prisma.eventCollaborator.deleteMany({
      where: { eventId, profileId },
    });
    if (count === 0) throw new NotFoundException('Collaborator not found');
  }
}
