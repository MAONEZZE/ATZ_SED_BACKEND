import { Inject, Injectable } from '@nestjs/common';
import {
  OUTBOX_REPOSITORY_PORT,
  OutboxRepositoryPort,
} from '@modules/messaging/ports/outbox-repository.port';
import { MessageLogsRepository } from '@modules/messaging/message-logs.repository';

export type UazapiStatus =
  | 'Queued'
  | 'Canceled'
  | 'Failed'
  | 'Sent'
  | 'Delivered'
  | 'Read'
  | string;

export interface StatusUpdateInput {
  /** id da mensagem no provedor (uazapi messageid) */
  providerMessageId?: string | null;
  /** track_id que enviamos = OutboxMessage.id */
  trackId?: string | null;
  status: UazapiStatus;
  /** timestamp do evento (ms epoch) */
  at?: number | null;
  /** motivo quando status = Failed */
  error?: string | null;
}

@Injectable()
export class DeliveryStatusService {
  constructor(
    @Inject(OUTBOX_REPOSITORY_PORT) private readonly outboxRepo: OutboxRepositoryPort,
    private readonly messageLogs: MessageLogsRepository,
  ) {}

  async applyStatusUpdate(input: StatusUpdateInput): Promise<void> {
    const { providerMessageId, trackId, status, error } = input;
    if (!providerMessageId && !trackId) return;

    const at = input.at ? new Date(input.at) : new Date();
    const s = (status || '').toLowerCase();

    if (s === 'delivered') {
      await this.markDelivered(providerMessageId, trackId, at);
    } else if (s === 'read') {
      await this.markRead(providerMessageId, trackId, at);
    } else if (s === 'failed') {
      await this.markFailed(providerMessageId, trackId, error ?? 'delivery failed');
    }
    // Sent/Queued/Canceled: ignorados (o envio já marca 'sent').
  }

  private async markDelivered(
    providerMessageId: string | null | undefined,
    trackId: string | null | undefined,
    at: Date,
  ) {
    await this.outboxRepo.markDeliveredIfUnset({ providerMessageId, trackId }, at);
    if (providerMessageId) {
      await this.messageLogs.markDeliveredIfUnset(providerMessageId, at);
    }
  }

  private async markRead(
    providerMessageId: string | null | undefined,
    trackId: string | null | undefined,
    at: Date,
  ) {
    await this.outboxRepo.markReadIfUnset({ providerMessageId, trackId }, at);
    if (providerMessageId) {
      await this.messageLogs.markReadIfUnset(providerMessageId, at);
    }
  }

  private async markFailed(
    providerMessageId: string | null | undefined,
    trackId: string | null | undefined,
    error: string,
  ) {
    await this.outboxRepo.markFailedIfUndelivered({ providerMessageId, trackId }, error);
    if (providerMessageId) {
      await this.messageLogs.markFailedIfUndelivered(providerMessageId, error);
    }
  }
}
