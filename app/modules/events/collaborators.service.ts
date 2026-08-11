import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  EVENT_REPOSITORY_PORT,
  EventRepositoryPort,
} from '@modules/events/ports/event-repository.port';
import { CollaboratorsRepository } from '@modules/events/collaborators.repository';
import { ProfileRepository } from '@modules/users/profile.repository';

@Injectable()
export class CollaboratorsService {
  constructor(
    @Inject(EVENT_REPOSITORY_PORT) private readonly eventRepo: EventRepositoryPort,
    private readonly collaborators: CollaboratorsRepository,
    private readonly profiles: ProfileRepository,
  ) {}

  list(eventId: string) {
    return this.collaborators.list(eventId);
  }

  async add(eventId: string, email: string) {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new NotFoundException('Event not found');

    const profile = await this.profiles.findByEmail(email);
    if (!profile) {
      throw new NotFoundException('No registered user with this email. Ask them to sign up first.');
    }
    if (profile.id === event.ownerId) {
      throw new ConflictException('User is already the event owner');
    }

    return this.collaborators.upsert(eventId, profile.id);
  }

  async remove(eventId: string, profileId: string): Promise<void> {
    const count = await this.collaborators.remove(eventId, profileId);
    if (count === 0) throw new NotFoundException('Collaborator not found');
  }
}
