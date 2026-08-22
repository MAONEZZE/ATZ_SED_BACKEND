import { EntityBase } from '@domain/shared/entity.base';
import { MessageChannel } from '@domain/shared/message-channel.type';

/**
 * Histórico do que já foi enviado. Diferente do `OutboxMessage`, que é a fila:
 * o log só existe depois da tentativa de envio e nunca é reprocessado.
 *
 * `eventId`, `ownerId` e `registrationId` são todos anuláveis porque um envio
 * manual pode não estar preso a evento nem a inscrição.
 *
 * Campos públicos com o nome das colunas: a listagem paginada é serializada
 * direto como corpo da resposta.
 */
export class MessageLogEntity extends EntityBase {
  constructor(
    id: string,
    public readonly eventId: string | null,
    public readonly ownerId: string | null,
    public readonly registrationId: string | null,
    public readonly channel: MessageChannel,
    public readonly recipient: string,
    public readonly body: string,
    public readonly status: string,
    public readonly errorMessage: string | null,
    public readonly providerMessageId: string | null,
    public readonly deliveredAt: Date | null,
    public readonly readAt: Date | null,
    public readonly sentAt: Date | null,
    public readonly createdAt: Date,
  ) {
    super(id);
  }

  /**
   * Lido implica entregue. O fornecedor pode mandar os webhooks fora de ordem,
   * então o avanço de estado é monotônico: um `delivered` que chega depois de um
   * `read` não pode rebaixar a mensagem.
   */
  isDelivered(): boolean {
    return this.deliveredAt !== null || this.readAt !== null;
  }

  isRead(): boolean {
    return this.readAt !== null;
  }
}
