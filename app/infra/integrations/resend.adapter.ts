import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class ResendAdapter {
  private readonly client: Resend;
  private readonly from: string;
  private readonly logger = new Logger(ResendAdapter.name);

  constructor(config: ConfigService) {
    this.client = new Resend(config.get<string>('RESEND_API_KEY'));
    this.from = config.get<string>('RESEND_FROM_EMAIL')!;
  }

  async sendEmail(
    to: string,
    subject: string,
    html: string,
    icsContent?: string,
    attachments?: { filename: string; url: string }[],
  ): Promise<void> {
    const files: Array<{ filename: string; content?: string; path?: string }> = [];
    if (icsContent) {
      files.push({ filename: 'evento.ics', content: Buffer.from(icsContent).toString('base64') });
    }
    // Anexos do usuário vão por `path` (URL): o Resend baixa no momento do envio.
    // Exige URL pública e estável — falha de fetch vira falha de envio (com retry na fila).
    for (const a of attachments ?? []) {
      files.push({ filename: a.filename, path: a.url });
    }

    const { error } = await this.client.emails.send({
      from: this.from,
      to,
      subject,
      html,
      attachments: files,
    });

    if (error) {
      this.logger.error({ error, to }, 'Resend failed');
      throw new Error(`Resend error: ${error.message}`);
    }
  }
}
