import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CrmPort, CrmPayload } from '@domain/shared/i-crm';

@Injectable()
export class PipedriveAdapter implements CrmPort {
  private readonly webhookUrl: string;

  constructor(config: ConfigService) {
    this.webhookUrl = config.get<string>('PIPEDRIVE_WEBHOOK_URL')!;
  }

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
