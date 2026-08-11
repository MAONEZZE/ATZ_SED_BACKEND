import { EventEntity, EventStatus } from '../entities/event.entity';

export const EVENT_REPOSITORY_PORT = Symbol('EVENT_REPOSITORY_PORT');

export interface CreateEventData {
  ownerId: string;
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
  uazapiInstanceId?: string;
}

export interface UpdateEventData {
  title?: string;
  coverUrl?: string | null;
  location?: string;
  capacity?: number;
  dressCode?: string;
  groupLink?: string;
  eventDate?: Date;
  endDate?: Date;
  sendToPipedrive?: boolean;
  uazapiInstanceId?: string;
  uazapiToken?: string;
  lastEditedById?: string;
  recurrenceFreq?: string | null;
  recurrenceInterval?: number | null;
  recurrenceUntil?: Date | null;
}

export interface EventOwnership {
  ownerId: string;
  isCollaborator: boolean;
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
  findOwnershipById(id: string, profileId: string): Promise<EventOwnership | null>;
  /** Token da instância WhatsApp vinculada ao evento (relação uazapiInstance, não a coluna uazapiToken). */
  findWhatsappInstanceToken(id: string): Promise<string | null>;
}
