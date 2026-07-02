import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PipedrivePayload {
  event: { id: string; slug: string; title: string };
  form: 'registration';
  contact: { name: string; email: string; phone: string };
  answers: Record<string, unknown>;
}

@Injectable()
export class PipedriveAdapter {
  private readonly webhookUrl: string;

  constructor(config: ConfigService) {
    this.webhookUrl = config.get<string>('PIPEDRIVE_WEBHOOK_URL')!;
  }

  /**
   * Posts the payload to the n8n/Pipedrive webhook. Rejects on failure so the
   * caller can record the send status; the caller is responsible for keeping
   * this fire-and-forget (not awaiting before responding to the user).
   */
  async send(payload: PipedrivePayload): Promise<void> {
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pipedrive webhook error (${response.status}): ${errorText}`);
    }
  }
}
