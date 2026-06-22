import { Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(PipedriveAdapter.name);

  constructor(config: ConfigService) {
    this.webhookUrl = config.get<string>('PIPEDRIVE_WEBHOOK_URL')!;
  }

  /**
   * Fire-and-forget: never throws. A failed webhook must not fail the
   * registration flow. Callers may invoke without awaiting.
   */
  send(payload: PipedrivePayload): void {
    void this.post(payload).catch((err) => {
      this.logger.error({ err, eventId: payload.event.id }, 'Pipedrive webhook error');
    });
  }

  private async post(payload: PipedrivePayload): Promise<void> {
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
