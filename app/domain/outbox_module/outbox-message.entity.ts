import { EntityBase } from '@domain/shared/entity.base';
import { MessageChannel } from '@domain/shared/message-channel.type';

/**
 * Mensagem da fila de envio, na visão que o worker de despacho usa.
 *
 * `sentParts` e `sentAttachments` são o que torna o reenvio seguro: uma
 * mensagem quebrada em partes pode falhar no meio, e uma nova tentativa precisa
 * retomar de onde parou em vez de reenviar o que o destinatário já recebeu.
 * Esses contadores só avançam depois de cada parte sair.
 */
export class OutboxMessageEntity extends EntityBase {
  constructor(
    id: string,
    public readonly eventId: string | null,
    public readonly ownerId: string | null,
    public readonly registrationId: string | null,
    public readonly channel: MessageChannel,
    public readonly recipient: string,
    public readonly instancia: string | null,
    public readonly renderedBody: string,
    public readonly renderedSubject: string | null,
    public readonly inviteConfig: unknown,
    public readonly attachments: unknown,
    public readonly sentParts: number,
    public readonly sentAttachments: number,
    public readonly status: string,
  ) {
    super(id);
  }

  /** Retomada de uma tentativa anterior que parou no meio. */
  isResuming(): boolean {
    return this.sentParts > 0 || this.sentAttachments > 0;
  }

  /** Índice da primeira parte ainda não enviada. */
  nextPartIndex(): number {
    return this.sentParts;
  }

  /** Índice do primeiro anexo ainda não enviado. */
  nextAttachmentIndex(): number {
    return this.sentAttachments;
  }

  /** WhatsApp exige a instância (token); e-mail não. */
  requiresInstance(): boolean {
    return this.channel === 'whatsapp';
  }
}
