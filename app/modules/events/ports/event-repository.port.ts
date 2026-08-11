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

export interface EventDuplicationForm {
  kind: string;
  description: string | null;
  postRegistrationMessage: string | null;
  linkPostSubscription: string | null;
  fields: Array<{
    label: string;
    type: string;
    required: boolean;
    options: unknown;
    order: number;
    isFixed: boolean;
  }>;
}

export interface EventDuplicationAutomationRule {
  templateId: string;
  trigger: string;
  delayMinutes: number | null;
  active: boolean;
}

export interface EventDuplicationSource {
  title: string;
  location: string | null;
  capacity: number | null;
  dressCode: string | null;
  groupLink: string | null;
  eventDate: Date | null;
  endDate: Date | null;
  sendToPipedrive: boolean;
  forms: EventDuplicationForm[];
  automationRules: EventDuplicationAutomationRule[];
}

export interface CreateDuplicateEventData {
  ownerId: string;
  title: string;
  slug: string;
  location: string | null;
  capacity: number | null;
  dressCode: string | null;
  groupLink: string | null;
  eventDate: Date | null;
  endDate: Date | null;
  sendToPipedrive: boolean;
  lastEditedById: string;
}

export interface CreatedDuplicateEvent {
  id: string;
  ownerId: string;
  title: string;
  slug: string;
}

export interface EventAutomationContext {
  id: string;
  ownerId: string;
  title: string;
  eventDate: Date | null;
  location: string | null;
  capacity: number | null;
  dressCode: string | null;
  groupLink: string | null;
  /** Token da instância WhatsApp vinculada ao evento (mesma relação de findWhatsappInstanceToken). */
  whatsappToken: string | null;
}

/** Projeção pública do evento — só os campos seguros para expor sem autenticação. */
export interface PublicEventSummary {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  location: string | null;
  capacity: number | null;
  dressCode: string | null;
  eventDate: Date | null;
  endDate: Date | null;
  sendToPipedrive: boolean;
  status: EventStatus;
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
  findDuplicationSource(id: string): Promise<EventDuplicationSource | null>;
  createDuplicate(data: CreateDuplicateEventData): Promise<CreatedDuplicateEvent>;
  findPublicBySlug(slug: string): Promise<PublicEventSummary | null>;
  findStatusBySlug(slug: string): Promise<{ id: string; status: EventStatus } | null>;
  findAutomationContext(id: string): Promise<EventAutomationContext | null>;
  findWithApprovedRegistrationIds(
    id: string,
  ): Promise<{ id: string; registrationIds: string[] } | null>;
}
