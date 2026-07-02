import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@infra/prisma/prisma.service';
import {
  OutboxRepositoryPort,
  EnqueueMessageData,
  PendingOutboxMessage,
} from '@modules/messaging/ports/outbox-repository.port';

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
}
