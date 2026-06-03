import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma/prisma.service';
import {
  OutboxRepositoryPort,
  EnqueueMessageData,
  PendingOutboxMessage,
} from '@domain/messaging/ports/outbox-repository.port';
import type { MessageChannel } from '@domain/messaging/types/message-channel.type';

@Injectable()
export class PrismaOutboxRepository implements OutboxRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(data: EnqueueMessageData): Promise<void> {
    await this.prisma.outboxMessage.upsert({
      where: {
        registrationId_templateId_trigger: {
          registrationId: data.registrationId,
          templateId: data.templateId,
          trigger: data.trigger,
        },
      },
      update: {},
      create: { ...data, status: 'pending' },
    });
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
      channel: r.channel as MessageChannel,
    }));
  }
}
