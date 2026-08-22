import { EntityBase } from '@domain/shared/entity.base';
import { MessageChannel } from '@domain/shared/message-channel.type';

/**
 * Modelo de mensagem reutilizável de um usuário. `eventId` nulo significa
 * template global (serve a qualquer evento do dono); preenchido, o template é
 * daquele evento.
 *
 * Todos os campos são públicos e com o mesmo nome das colunas porque a listagem
 * paginada serializa a entidade direto como corpo da resposta HTTP.
 */
export class MessageTemplateEntity extends EntityBase {
  constructor(
    id: string,
    public readonly ownerId: string,
    public readonly name: string,
    public readonly channel: MessageChannel,
    public readonly subject: string | null,
    public readonly body: string,
    public readonly layoutConfig: Record<string, unknown> | null,
    public readonly styleKey: string | null,
    public readonly eventId: string | null,
    /** Pasta que organiza o template. Tem que ter o mesmo `eventId` dele. */
    public readonly folderId: string | null,
    /** Posição manual dentro da pasta (ou da raiz). */
    public readonly order: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }

  isGlobal(): boolean {
    return this.eventId === null;
  }

  /**
   * E-mail sem assunto não é enviável; WhatsApp não tem assunto. A regra vale
   * tanto na criação quanto na edição, onde os valores resultantes podem vir de
   * campos do template existente misturados com os do patch.
   */
  static requiresSubject(channel: MessageChannel, subject?: string | null): boolean {
    return channel === 'email' && !subject?.trim();
  }
}
