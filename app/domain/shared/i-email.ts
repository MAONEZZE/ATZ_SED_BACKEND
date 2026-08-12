export const EMAIL_PORT = Symbol('EMAIL_PORT');

/** Anexo enviado por URL pública: o provedor baixa o arquivo no momento do envio. */
export interface EmailAttachment {
  filename: string;
  url: string;
}

/**
 * Contrato de envio de e-mail. O remetente (`from`) não entra na assinatura:
 * é configuração do provedor, resolvida na implementação.
 */
export interface EmailPort {
  sendEmail(
    to: string,
    subject: string,
    html: string,
    /** Conteúdo .ics do convite, anexado como `evento.ics` quando presente. */
    icsContent?: string,
    attachments?: EmailAttachment[],
  ): Promise<void>;
}
