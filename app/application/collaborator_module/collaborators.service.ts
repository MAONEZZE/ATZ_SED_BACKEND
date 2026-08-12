import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  EVENT_REPOSITORY_PORT,
  EventRepositoryPort,
} from '@domain/event_module/i-repository-event';
import {
  COLLABORATOR_REPOSITORY_PORT,
  CollaboratorRepositoryPort,
} from '@domain/collaborator_module/i-repository-collaborator';
import {
  PROFILE_REPOSITORY_PORT,
  ProfileRepositoryPort,
} from '@domain/profile_module/i-repository-profile';

@Injectable()
export class CollaboratorsService {
  constructor(
    @Inject(EVENT_REPOSITORY_PORT) private readonly eventRepo: EventRepositoryPort,
    @Inject(COLLABORATOR_REPOSITORY_PORT)
    private readonly collaborators: CollaboratorRepositoryPort,
    @Inject(PROFILE_REPOSITORY_PORT)
    private readonly profiles: ProfileRepositoryPort,
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
