import { MessageChannel } from '@domain/shared/message-channel.type';
import { MessageTemplateEntity } from './message-template.entity';

export const MESSAGE_TEMPLATE_REPOSITORY_PORT = Symbol('MESSAGE_TEMPLATE_REPOSITORY_PORT');

export interface CreateMessageTemplateData {
  ownerId: string;
  name: string;
  channel: MessageChannel;
  subject?: string | null;
  body: string;
  layoutConfig?: Record<string, unknown> | null;
  styleKey?: string | null;
  eventId?: string | null;
}

/** Chave ausente deixa a coluna intacta. `eventId: null` desvincula do evento. */
export interface UpdateMessageTemplateData {
  name?: string;
  channel?: MessageChannel;
  subject?: string | null;
  body?: string;
  layoutConfig?: Record<string, unknown> | null;
  styleKey?: string | null;
  eventId?: string | null;
}

/**
 * Filtro semântico da listagem. `eventId` distingue três casos:
 *   undefined → todos os templates do dono
 *   null      → só os globais
 *   string    → só os daquele evento
 */
export interface MessageTemplateFilter {
  eventId?: string | null;
  channel?: MessageChannel;
}

export interface MessageTemplateRepositoryPort {
  create(data: CreateMessageTemplateData): Promise<MessageTemplateEntity>;

  /**
   * O dono é parte da consulta, não um filtro aplicado depois: sem ele um id
   * conhecido devolveria template de outra conta.
   */
  findByIdForOwner(id: string, ownerId: string): Promise<MessageTemplateEntity | null>;

  findFirstForOwner(ownerId: string): Promise<MessageTemplateEntity | null>;

  findAllForOwnerPaginated(
    ownerId: string,
    filter: MessageTemplateFilter,
    pagination: { skip: number; take: number },
  ): Promise<{ data: MessageTemplateEntity[]; total: number }>;

  update(id: string, data: UpdateMessageTemplateData): Promise<MessageTemplateEntity>;

  delete(id: string): Promise<void>;

  /** Verdadeiro se o evento existe e o usuário é dono ou colaborador dele. */
  eventAccessible(eventId: string, userId: string): Promise<boolean>;
}
