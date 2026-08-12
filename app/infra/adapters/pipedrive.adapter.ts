import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CrmPort, CrmPayload } from '@domain/shared/i-crm';

@Injectable()
export class PipedriveAdapter implements CrmPort {
  private readonly webhookUrl: string;

  constructor(config: ConfigService) {
    this.webhookUrl = config.get<string>('PIPEDRIVE_WEBHOOK_URL')!;
  }

  /**
   * Posts the payload to the n8n/Pipedrive webhook. Rejects on failure so the
   * caller can record the send status; the caller is responsible for keeping
   * this fire-and-forget (not awaiting before responding to the user).
   */
  async send(payload: CrmPayload): Promise<void> {
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
