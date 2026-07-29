import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infra/prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

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

  private outboxWhere(providerMessageId?: string | null, trackId?: string | null) {
    // trackId == OutboxMessage.id (setado no envio); providerMessageId como fallback.
    if (trackId) return { id: trackId };
    return { providerMessageId: providerMessageId! };
  }

  private async markDelivered(
    providerMessageId: string | null | undefined,
    trackId: string | null | undefined,
    at: Date,
  ) {
    // só-avança: não sobrescreve se já entregue/lido
    await this.prisma.outboxMessage.updateMany({
      where: { ...this.outboxWhere(providerMessageId, trackId), deliveredAt: null, readAt: null },
      data: { deliveredAt: at },
    });
    if (providerMessageId) {
      await this.prisma.messageLog.updateMany({
        where: { providerMessageId, deliveredAt: null, readAt: null },
        data: { deliveredAt: at, status: 'delivered' },
      });
    }
  }

  private async markRead(
    providerMessageId: string | null | undefined,
    trackId: string | null | undefined,
    at: Date,
  ) {
    await this.prisma.outboxMessage.updateMany({
      where: { ...this.outboxWhere(providerMessageId, trackId), readAt: null },
      data: { readAt: at },
    });
    // garante deliveredAt preenchido (read implica delivered)
    await this.prisma.outboxMessage.updateMany({
      where: { ...this.outboxWhere(providerMessageId, trackId), deliveredAt: null },
      data: { deliveredAt: at },
    });
    if (providerMessageId) {
      await this.prisma.messageLog.updateMany({
        where: { providerMessageId, readAt: null },
        data: { readAt: at, status: 'read' },
      });
      await this.prisma.messageLog.updateMany({
        where: { providerMessageId, deliveredAt: null },
        data: { deliveredAt: at },
      });
    }
  }

  private async markFailed(
    providerMessageId: string | null | undefined,
    trackId: string | null | undefined,
    error: string,
  ) {
    // não rebaixa uma mensagem já entregue/lida
    await this.prisma.outboxMessage.updateMany({
      where: { ...this.outboxWhere(providerMessageId, trackId), deliveredAt: null, readAt: null },
      data: { status: 'failed', errorMessage: error },
    });
    if (providerMessageId) {
      await this.prisma.messageLog.updateMany({
        where: { providerMessageId, deliveredAt: null, readAt: null },
        data: { status: 'failed', errorMessage: error },
      });
    }
  }
}
