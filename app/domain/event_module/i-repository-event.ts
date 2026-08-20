import { EventRole } from '@domain/collaborator_module/event-role.type';
import { EventEntity, EventStatus } from './event.entity';

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
  whatsappInstanceId?: string;
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
  whatsappInstanceId?: string;
  whatsappToken?: string;
  lastEditedById?: string;
  recurrenceFreq?: string | null;
  recurrenceInterval?: number | null;
  recurrenceUntil?: Date | null;
  /** `null` move o evento para a raiz (fora de qualquer pasta). */
  folderId?: string | null;
}

/**
 * Evento + papel do usuário que consultou a lista. O front decide com isto o que
 * renderizar por card (ex.: 'Excluir' para admin, 'Sair' para invited/read) sem
 * pedir os colaboradores de cada evento. É só dica de UI: a autorização segue
 * sendo do OwnershipGuard, que resolve o papel no banco a cada request.
 */
export type EventWithMyRole = EventEntity & { myRole: EventRole };

export interface EventOwnership {
  ownerId: string;
  isCollaborator: boolean;
  /** Papel efetivo do usuário consultado: dono → 'admin'; sem vínculo → null. */
  role: EventRole | null;
}

export interface EventDuplicationForm {
  name: string;
  slug: string;
  order: number;
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
  cron: string | null;
  timezone: string | null;
  /** Data do gatilho `on_date`. Copiada, mas a regra nasce inativa: a data é do evento antigo. */
  sendAt: Date | null;
  active: boolean;
  order: number;
  /**
   * Slugs dos formulários que escopam a regra (vazio = todos). Slug, não id:
   * `createWithFields` preserva o slug do formulário original, então
   * `(novoEventId, slug)` resolve o id no evento duplicado.
   */
  formSlugs: string[];
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
  /** Rascunho e cancelado não disparam automação — checado no AutomationEngine. */
  status: EventStatus;
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
  /**
   * `folderId` distingue três casos, como o filtro de templates:
   *   undefined → todos os eventos acessíveis
   *   null      → só os que estão fora de qualquer pasta (raiz)
   *   string    → só os daquela pasta
   */
  findAllByOwnerPaginated(
    ownerId: string,
    pagination: { skip: number; take: number },
    folderId?: string | null,
  ): Promise<{ data: EventWithMyRole[]; total: number }>;
  /** Reescreve `order` na ordem dos ids, dentro do escopo (dono + pasta). */
  reorder(ownerId: string, folderId: string | null, ids: string[]): Promise<void>;
  /**
   * Move o evento para antes de `beforeId` (ausente = fim) na pasta em que ele
   * já está. `false` = evento ou âncora fora do escopo acessível.
   */
  move(ownerId: string, id: string, beforeId?: string): Promise<boolean>;
  create(data: CreateEventData): Promise<EventEntity>;
  update(id: string, data: UpdateEventData): Promise<EventEntity>;
  updateStatus(id: string, status: EventStatus, editorId?: string): Promise<EventEntity>;
  delete(id: string): Promise<void>;
  findOwnershipById(id: string, profileId: string): Promise<EventOwnership | null>;
  /** Token da instância WhatsApp vinculada ao evento (relação whatsappInstance, não a coluna whatsappToken). */
  findWhatsappInstanceToken(id: string): Promise<string | null>;
  findDuplicationSource(id: string): Promise<EventDuplicationSource | null>;
  createDuplicate(data: CreateDuplicateEventData): Promise<CreatedDuplicateEvent>;
  findPublicBySlug(slug: string): Promise<PublicEventSummary | null>;
  findAutomationContext(id: string): Promise<EventAutomationContext | null>;
  findWithApprovedRegistrationIds(
    id: string,
  ): Promise<{ id: string; registrationIds: string[] } | null>;
}
