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

  async sendEmail(to: string, subject: string, html: string, icsContent?: string): Promise<void> {
    const attachments = icsContent
      ? [
          {
            filename: 'evento.ics',
            content: Buffer.from(icsContent).toString('base64'),
          },
        ]
      : [];

    const { error } = await this.client.emails.send({
      from: this.from,
      to,
      subject,
      html,
      attachments,
    });

    if (error) {
      this.logger.error({ error, to }, 'Resend failed');
      throw new Error(`Resend error: ${error.message}`);
    }
  }
}
