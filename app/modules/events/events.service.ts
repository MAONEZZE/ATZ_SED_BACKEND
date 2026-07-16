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
} from '@modules/events/ports/event-repository.port';
import { STORAGE_PORT, StoragePort } from '@infra/storage/storage.port';
import { EventEntity, EventStatus } from '@modules/events/entities/event.entity';
import { ConfigService } from '@nestjs/config';

export interface CreateEventInput {
  title: string;
  location?: string;
  capacity?: number;
  dressCode?: string;
  groupLink?: string;
  eventDate?: Date;
  endDate?: Date;
  sendToPipedrive?: boolean;
  recurrenceFreq?: string;
  recurrenceInterval?: number;
  recurrenceUntil?: Date;
  evolutionInstanceId?: string;
}

export interface UpdateEventInput {
  title?: string;
  location?: string;
  capacity?: number;
  dressCode?: string;
  groupLink?: string;
  eventDate?: Date;
  endDate?: Date;
  sendToPipedrive?: boolean;
  evolutionInstanceId?: string;
  evolutionToken?: string;
  recurrenceFreq?: string;
  recurrenceInterval?: number;
  recurrenceUntil?: Date;
}

@Injectable()
export class EventsService {
  constructor(
    @Inject(EVENT_REPOSITORY_PORT) private readonly eventRepo: EventRepositoryPort,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly config: ConfigService,
  ) {}

  async create(ownerId: string, input: CreateEventInput): Promise<EventEntity> {
    this.assertValidPeriod(input.eventDate, input.endDate);
    return this.eventRepo.create({ ...input, ownerId });
  }

  async findAll(ownerId: string): Promise<EventEntity[]> {
    return this.eventRepo.findAllByOwner(ownerId);
  }

  async findAllPaginated(
    ownerId: string,
    page: number,
    limit: number,
  ): Promise<{ data: EventEntity[]; total: number }> {
    return this.eventRepo.findAllByOwnerPaginated(ownerId, {
      skip: (page - 1) * limit,
      take: limit,
    });
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

  async update(id: string, input: UpdateEventInput, editorId?: string): Promise<EventEntity> {
    const event = await this.findById(id);
    if (!event.isEditable()) {
      throw new ForbiddenException('Cancelled or ended events cannot be edited');
    }
    this.assertValidPeriod(input.eventDate ?? event.eventDate, input.endDate ?? event.endDate);
    return this.eventRepo.update(id, editorId ? { ...input, lastEditedById: editorId } : input);
  }

  private assertValidPeriod(eventDate?: Date, endDate?: Date): void {
    if (eventDate && endDate && endDate.getTime() <= eventDate.getTime()) {
      throw new BadRequestException('endDate must be after eventDate');
    }
  }

  async updateStatus(id: string, status: EventStatus, editorId?: string): Promise<EventEntity> {
    const event = await this.findById(id);
    if (!event.canTransitionTo(status)) {
      throw new BadRequestException(`Cannot transition from '${event.status}' to '${status}'`);
    }
    return this.eventRepo.updateStatus(id, status, editorId);
  }

  async uploadCover(
    id: string,
    file: Buffer,
    mimeType: string,
    editorId?: string,
  ): Promise<EventEntity> {
    await this.findById(id);
    const bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'ATZ_SED';
    const folder = this.config.get<string>('SUPABASE_STORAGE_BUCKET_COVERS') ?? 'event-covers';
    const path = `${folder}/${id}/cover`;
    const { url } = await this.storage.upload(bucket, path, file, mimeType);
    return this.eventRepo.update(
      id,
      editorId ? { coverUrl: url, lastEditedById: editorId } : { coverUrl: url },
    );
  }

  async deleteCover(id: string, editorId?: string): Promise<EventEntity> {
    const event = await this.findById(id);
    if (event.coverUrl) {
      const bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'ATZ_SED';
      const folder = this.config.get<string>('SUPABASE_STORAGE_BUCKET_COVERS') ?? 'event-covers';
      const path = `${folder}/${id}/cover`;
      try {
        await this.storage.delete(bucket, path);
      } catch {}
    }
    return this.eventRepo.update(
      id,
      editorId ? { coverUrl: null, lastEditedById: editorId } : { coverUrl: null },
    );
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.eventRepo.delete(id);
  }
}
