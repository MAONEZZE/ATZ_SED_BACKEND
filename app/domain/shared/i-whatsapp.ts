export const WHATSAPP_PORT = Symbol('WHATSAPP_PORT');

export type WhatsappMediaType = 'image' | 'video' | 'audio' | 'document';

/**
 * Restrição temporária imposta pelo WhatsApp ao número (não é erro da API).
 * Ex.: erro 463 / `WHATSAPP_REACHOUT_TIMELOCK` — conta bloqueada para iniciar
 * novas conversas por volume/qualidade. Não adianta retentar antes de `until`;
 * o worker trata isso como não-retentável para não martelar um chip restrito.
 *
 * Vive no domínio, e não no adapter, porque o worker decide política de retry
 * a partir dele — se morasse no infra, `application` dependeria do fornecedor
 * só para tratar a exceção.
 */
export class WhatsappRestrictionError extends Error {
  constructor(
    message: string,
    readonly providerCode: number,
    readonly until: Date | null,
  ) {
    super(message);
    this.name = 'WhatsappRestrictionError';
  }
}

export interface SendWhatsappOptions {
  /** Índice da primeira parte a enviar; usado no retry para não reenviar o que já saiu. */
  startIndex?: number;
  onPartSent?: (index: number) => void | Promise<void>;
  trackId?: string;
}

/**
 * Contrato de envio por WhatsApp. Descreve o que a aplicação precisa, não como
 * o fornecedor faz — a quebra da mensagem em partes, o delay de digitação e o
 * formato de payload são detalhes da implementação.
 *
 * Todos os métodos recebem `token` porque a instância é identificada por token
 * próprio, um por instância conectada.
 *
 * Retorno de envio: o id da mensagem no fornecedor (última parte enviada), ou
 * null quando ele não devolve id — é o que correlaciona o webhook de status.
 */
export interface WhatsappPort {
  sendWhatsApp(
    token: string,
    to: string,
    body: string,
    opts?: SendWhatsappOptions,
  ): Promise<string | null>;

  sendMedia(
    token: string,
    to: string,
    mediaUrl: string,
    mediatype: WhatsappMediaType,
    mimetype: string,
    fileName: string,
    caption?: string,
    trackId?: string,
  ): Promise<string | null>;

  setWebhook(token: string, url: string, events: string[]): Promise<void>;

  fetchGroups(token: string): Promise<{ id: string; subject: string }[]>;

  getInstanceStatus(token: string): Promise<string | null>;
}
