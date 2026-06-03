import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  EVENT_REPOSITORY_PORT,
  EventRepositoryPort,
} from '@domain/events/ports/event-repository.port';
import { STORAGE_PORT, StoragePort } from '@domain/shared/ports/storage.port';
import { EventEntity, EventStatus } from '@domain/events/entities/event.entity';
import { ConfigService } from '@nestjs/config';

export interface CreateEventInput {
  title: string;
  description?: string;
  location?: string;
  capacity?: number;
  dressCode?: string;
  groupLink?: string;
  eventDate?: Date;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  location?: string;
  capacity?: number;
  dressCode?: string;
  groupLink?: string;
  eventDate?: Date;
  evolutionInstance?: string;
  evolutionToken?: string;
}

@Injectable()
export class EventsService {
  constructor(
    @Inject(EVENT_REPOSITORY_PORT) private readonly eventRepo: EventRepositoryPort,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly config: ConfigService,
  ) {}

  async create(ownerId: string, input: CreateEventInput): Promise<EventEntity> {
    return this.eventRepo.create({ ...input, ownerId });
  }

  async findAll(ownerId: string): Promise<EventEntity[]> {
    return this.eventRepo.findAllByOwner(ownerId);
  }

  async findById(id: string): Promise<EventEntity> {
    const event = await this.eventRepo.findById(id);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async findBySlug(slug: string): Promise<EventEntity> {
    const event = await this.eventRepo.findBySlug(slug);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async update(id: string, input: UpdateEventInput): Promise<EventEntity> {
    const event = await this.findById(id);
    if (!event.isEditable()) {
      throw new ForbiddenException('Cancelled events cannot be edited');
    }
    return this.eventRepo.update(id, input);
  }

  async updateStatus(id: string, status: EventStatus): Promise<EventEntity> {
    const event = await this.findById(id);
    if (!event.canTransitionTo(status)) {
      throw new BadRequestException(
        `Cannot transition from '${event.status}' to '${status}'`,
      );
    }
    return this.eventRepo.updateStatus(id, status);
  }

  async uploadCover(
    id: string,
    file: Buffer,
    mimeType: string,
  ): Promise<EventEntity> {
    await this.findById(id);
    const bucket =
      this.config.get<string>('SUPABASE_STORAGE_BUCKET_COVERS') ?? 'event-covers';
    const path = `${id}/cover`;
    const { url } = await this.storage.upload(bucket, path, file, mimeType);
    return this.eventRepo.update(id, { coverUrl: url });
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.eventRepo.delete(id);
  }
}
