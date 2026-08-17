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
 *   null      → só os globais do dono
 *   string    → os daquele evento (de qualquer dono, o acesso ao evento é
 *               verificado antes) mais os globais do dono
 */
export interface MessageTemplateFilter {
  eventId?: string | null;
  channel?: MessageChannel;
}

export interface MessageTemplateRepositoryPort {
  create(data: CreateMessageTemplateData): Promise<MessageTemplateEntity>;

  /**
   * O acesso é parte da consulta, não um filtro aplicado depois: sem ele um id
   * conhecido devolveria template de outra conta. Acessa quem é dono do template
   * ou quem é dono/colaborador do evento ao qual ele está vinculado.
   */
  findByIdForUser(id: string, userId: string): Promise<MessageTemplateEntity | null>;

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
