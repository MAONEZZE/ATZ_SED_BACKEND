import { EventEntity, EventStatus } from '../entities/event.entity';

export const EVENT_REPOSITORY_PORT = Symbol('EVENT_REPOSITORY_PORT');

export interface CreateEventData {
  ownerId: string;
  title: string;
  description?: string;
  location?: string;
  capacity?: number;
  dressCode?: string;
  groupLink?: string;
  eventDate?: Date;
  endDate?: Date;
  postRegistrationMessage?: string;
  sendToPipedrive?: boolean;
}

export interface UpdateEventData {
  title?: string;
  description?: string;
  coverUrl?: string | null;
  location?: string;
  capacity?: number;
  dressCode?: string;
  groupLink?: string;
  eventDate?: Date;
  endDate?: Date;
  postRegistrationMessage?: string;
  sendToPipedrive?: boolean;
  evolutionInstance?: string;
  evolutionToken?: string;
  lastEditedById?: string;
}

export interface EventRepositoryPort {
  findById(id: string): Promise<EventEntity | null>;
  findBySlug(slug: string): Promise<EventEntity | null>;
  findAllByOwner(ownerId: string): Promise<EventEntity[]>;
  findAllByOwnerPaginated(
    ownerId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ data: EventEntity[]; total: number }>;
  create(data: CreateEventData): Promise<EventEntity>;
  update(id: string, data: UpdateEventData): Promise<EventEntity>;
  updateStatus(id: string, status: EventStatus, editorId?: string): Promise<EventEntity>;
  delete(id: string): Promise<void>;
}
