import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@infra/prisma/prisma.service';
import {
  OutboxRepositoryPort,
  EnqueueMessageData,
  PendingOutboxMessage,
  OutboxDeliveryTarget,
} from '@domain/outbox_module/i-repository-outbox';
import { OutboxMessageEntity } from '@domain/outbox_module/outbox-message.entity';
import { MessageChannel } from '@domain/shared/message-channel.type';

const DISPATCH_SELECT = {
  id: true,
  eventId: true,
  ownerId: true,
  registrationId: true,
  channel: true,
  recipient: true,
  instancia: true,
  renderedBody: true,
  renderedSubject: true,
  inviteConfig: true,
  attachments: true,
  sentParts: true,
  sentAttachments: true,
  status: true,
} as const;

@Injectable()
export class PrismaOutboxRepository implements OutboxRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(
    data: EnqueueMessageData & { dedupKey: string },
  ): Promise<{ id: string; created: boolean }> {
    // create + catch P2002 (em vez de upsert) para distinguir linha nova de
    // duplicada via dedupKey. O chamador usa `created` para só aplicar o pacing
    // anti-ban em mensagens realmente novas (reprocessamentos do scheduled worker
    // não devem avançar o cursor de espaçamento).
    try {
      const { inviteConfig, attachments, ...rest } = data;
      const row = await this.prisma.outboxMessage.create({
        data: {
          ...rest,
          status: 'pending',
          inviteConfig: inviteConfig
            ? (inviteConfig as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          attachments: attachments
            ? (attachments as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
        select: { id: true },
      });
      return { id: row.id, created: true };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.prisma.outboxMessage.findUniqueOrThrow({
          where: { dedupKey: data.dedupKey },
          select: { id: true },
        });
        return { id: existing.id, created: false };
      }
      throw err;
    }
  }

  async claimStuck(olderThanMinutes: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    const { count } = await this.prisma.outboxMessage.updateMany({
      where: { status: 'processing', updatedAt: { lt: cutoff } },
      data: { status: 'pending' },
    });
    return count;
  }

  async markProcessing(id: string): Promise<void> {
    await this.prisma.outboxMessage.update({
      where: { id },
      data: { status: 'processing' },
    });
  }

  async markSent(id: string): Promise<void> {
    await this.prisma.outboxMessage.update({
      where: { id },
      data: { status: 'sent', processedAt: new Date() },
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.prisma.outboxMessage.update({
      where: { id },
      data: { status: 'failed', errorMessage: error, attempts: { increment: 1 } },
    });
  }

  async getPending(limit: number): Promise<PendingOutboxMessage[]> {
    const rows = await this.prisma.outboxMessage.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
        id: true,
        registrationId: true,
        channel: true,
        recipient: true,
        instancia: true,
        renderedBody: true,
        renderedSubject: true,
        templateId: true,
        trigger: true,
      },
    });
    return rows.map((r) => ({
      ...r,
      channel: r.channel,
    }));
  }

  // trackId == OutboxMessage.id (setado no envio); providerMessageId como fallback.
  private deliveryWhere(target: OutboxDeliveryTarget) {
    if (target.trackId) return { id: target.trackId };
    return { providerMessageId: target.providerMessageId! };
  }

  async markDeliveredIfUnset(target: OutboxDeliveryTarget, at: Date): Promise<void> {
    // só-avança: não sobrescreve se já entregue/lido
    await this.prisma.outboxMessage.updateMany({
      where: { ...this.deliveryWhere(target), deliveredAt: null, readAt: null },
      data: { deliveredAt: at },
    });
  }

  async markReadIfUnset(target: OutboxDeliveryTarget, at: Date): Promise<void> {
    await this.prisma.outboxMessage.updateMany({
      where: { ...this.deliveryWhere(target), readAt: null },
      data: { readAt: at },
    });
    // garante deliveredAt preenchido (read implica delivered)
    await this.prisma.outboxMessage.updateMany({
      where: { ...this.deliveryWhere(target), deliveredAt: null },
      data: { deliveredAt: at },
    });
  }

  async markFailedIfUndelivered(target: OutboxDeliveryTarget, error: string): Promise<void> {
    // não rebaixa uma mensagem já entregue/lida
    await this.prisma.outboxMessage.updateMany({
      where: { ...this.deliveryWhere(target), deliveredAt: null, readAt: null },
      data: { status: 'failed', errorMessage: error },
    });
  }

  private toEntity(row: {
    id: string;
    eventId: string | null;
    ownerId: string | null;
    registrationId: string | null;
    channel: string;
    recipient: string;
    instancia: string | null;
    renderedBody: string;
    renderedSubject: string | null;
    inviteConfig: unknown;
    attachments: unknown;
    sentParts: number;
    sentAttachments: number;
    status: string;
  }): OutboxMessageEntity {
    return new OutboxMessageEntity(
      row.id,
      row.eventId,
      row.ownerId,
      row.registrationId,
      row.channel as MessageChannel,
      row.recipient,
      row.instancia,
      row.renderedBody,
      row.renderedSubject,
      row.inviteConfig,
      row.attachments,
      row.sentParts,
      row.sentAttachments,
      row.status,
    );
  }

  async findDispatchById(id: string): Promise<OutboxMessageEntity | null> {
    const row = await this.prisma.outboxMessage.findUnique({
      where: { id },
      select: DISPATCH_SELECT,
    });
    return row ? this.toEntity(row) : null;
  }

  async findPendingDispatchByTrigger(
    registrationId: string | undefined,
    templateId: string | undefined,
    trigger: string | undefined,
  ): Promise<OutboxMessageEntity | null> {
    const row = await this.prisma.outboxMessage.findFirst({
      where: { registrationId, templateId, trigger, status: { in: ['pending', 'processing'] } },
      select: DISPATCH_SELECT,
    });
    return row ? this.toEntity(row) : null;
  }

  async markProcessingAttempt(id: string): Promise<void> {
    await this.prisma.outboxMessage.update({
      where: { id },
      data: { status: 'processing', attempts: { increment: 1 } },
    });
  }

  async updateSentParts(id: string, sentParts: number): Promise<void> {
    await this.prisma.outboxMessage.update({ where: { id }, data: { sentParts } });
  }

  async updateSentAttachments(id: string, sentAttachments: number): Promise<void> {
    await this.prisma.outboxMessage.update({ where: { id }, data: { sentAttachments } });
  }

  async markDispatchSent(id: string, providerMessageId: string | null): Promise<void> {
    await this.prisma.outboxMessage.update({
      where: { id },
      data: { status: 'sent', processedAt: new Date(), providerMessageId },
    });
  }

  async markDispatchFailed(id: string, error: string): Promise<void> {
    await this.prisma.outboxMessage.update({
      where: { id },
      data: { status: 'failed', errorMessage: error },
    });
  }
}
