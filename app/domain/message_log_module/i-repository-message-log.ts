import { MessageChannel } from '@domain/shared/message-channel.type';
import { MessageLogEntity } from './message-log.entity';

export const MESSAGE_LOG_REPOSITORY_PORT = Symbol('MESSAGE_LOG_REPOSITORY_PORT');

export interface CreateMessageLogData {
  eventId: string | null;
  ownerId: string | null;
  registrationId: string | null;
  channel: MessageChannel;
  recipient: string;
  body: string;
  status: string;
  providerMessageId?: string | null;
  sentAt?: Date;
  errorMessage?: string;
}

/**
 * Listagem global: o log com o evento a que pertence, para a tela exibir o
 * título. O evento é anexado à entidade em vez de embrulhá-la, porque esta
 * lista é serializada direto como corpo da resposta e embrulhar mudaria o
 * contrato com o frontend.
 */
export type MessageLogWithEvent = MessageLogEntity & {
  event: { id: string; title: string } | null;
};

/**
 * Só escreve e lê; não atualiza registro por id. As transições de estado
 * (`mark*`) são feitas em lote pelo `providerMessageId`, porque quem as dispara
 * é o webhook do fornecedor, que só conhece o id dele — e uma mensagem enviada
 * em partes gera vários logs com o mesmo id.
 */
export interface MessageLogRepositoryPort {
  create(data: CreateMessageLogData): Promise<void>;

  findByEventPaginated(
    eventId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ data: MessageLogEntity[]; total: number }>;

  /** Sem paginação: alimenta a exportação, que percorre tudo de uma vez. */
  streamByEvent(eventId: string, take: number): Promise<MessageLogEntity[]>;

  findAllForUserPaginated(
    userId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ data: MessageLogWithEvent[]; total: number }>;

  /** Não rebaixa uma mensagem já lida. */
  markDeliveredIfUnset(providerMessageId: string, at: Date): Promise<void>;
  /** Marca lida e preenche a entrega, caso o webhook de entrega não tenha chegado. */
  markReadIfUnset(providerMessageId: string, at: Date): Promise<void>;
  /** Só falha o que ainda não chegou ao destinatário. */
  markFailedIfUndelivered(providerMessageId: string, error: string): Promise<void>;
}
