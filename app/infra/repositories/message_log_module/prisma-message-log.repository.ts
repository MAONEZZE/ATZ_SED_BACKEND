import { Injectable } from '@nestjs/common';
import { PrismaRepositoryBase } from '@infra/repositories/shared/prisma-repository.base';
import { MessageChannel } from '@domain/shared/message-channel.type';
import { MessageLogEntity } from '@domain/message_log_module/message-log.entity';
import {
  CreateMessageLogData,
  MessageLogRepositoryPort,
  MessageLogWithEvent,
} from '@domain/message_log_module/i-repository-message-log';

type MessageLogRow = {
  id: string;
  eventId: string | null;
  ownerId: string | null;
  registrationId: string | null;
  channel: string;
  recipient: string;
  body: string;
  status: string;
  errorMessage: string | null;
  providerMessageId: string | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
};

/**
 * Um log pertence ao evento diretamente (`eventId`) ou por tabela — via a
 * inscrição, quando o envio foi disparado sem evento explícito.
 */
const byEvent = (eventId: string) => ({
  OR: [{ eventId }, { eventId: null, registration: { eventId } }],
});

@Injectable()
export class PrismaMessageLogRepository
  extends PrismaRepositoryBase
  implements MessageLogRepositoryPort
{
  private toEntity(row: MessageLogRow): MessageLogEntity {
    return new MessageLogEntity(
      row.id,
      row.eventId,
      row.ownerId,
      row.registrationId,
      row.channel as MessageChannel,
      row.recipient,
      row.body,
      row.status,
      row.errorMessage,
      row.providerMessageId,
      row.deliveredAt,
      row.readAt,
      row.sentAt,
      row.createdAt,
    );
  }

  async create(data: CreateMessageLogData): Promise<void> {
    await this.prisma.messageLog.create({ data });
  }

  async findByEventPaginated(
    eventId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ data: MessageLogEntity[]; total: number }> {
    const where = byEvent(eventId);
    const [rows, total] = await Promise.all([
      this.prisma.messageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.messageLog.count({ where }),
    ]);
    return { data: rows.map((row) => this.toEntity(row)), total };
  }

  async streamByEvent(eventId: string, take: number): Promise<MessageLogEntity[]> {
    const rows = await this.prisma.messageLog.findMany({
      where: byEvent(eventId),
      orderBy: { createdAt: 'desc' },
      take,
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findAllForUserPaginated(
    userId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ data: MessageLogWithEvent[]; total: number }> {
    // O usuário vê o log de eventos que possui ou colabora, mais os envios
    // avulsos atribuídos a ele.
    const where = {
      OR: [
        {
          event: { OR: [{ ownerId: userId }, { collaborators: { some: { profileId: userId } } }] },
        },
        { ownerId: userId },
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.messageLog.findMany({
        where,
        include: { event: { select: { id: true, title: true } } },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.messageLog.count({ where }),
    ]);

    const data = rows.map((row) =>
      Object.assign(this.toEntity(row), { event: row.event }),
    ) as MessageLogWithEvent[];
    return { data, total };
  }

  async markDeliveredIfUnset(providerMessageId: string, at: Date): Promise<void> {
    await this.prisma.messageLog.updateMany({
      where: { providerMessageId, deliveredAt: null, readAt: null },
      data: { deliveredAt: at, status: 'delivered' },
    });
  }

  async markReadIfUnset(providerMessageId: string, at: Date): Promise<void> {
    await this.prisma.messageLog.updateMany({
      where: { providerMessageId, readAt: null },
      data: { readAt: at, status: 'read' },
    });
    await this.prisma.messageLog.updateMany({
      where: { providerMessageId, deliveredAt: null },
      data: { deliveredAt: at },
    });
  }

  async markFailedIfUndelivered(providerMessageId: string, error: string): Promise<void> {
    await this.prisma.messageLog.updateMany({
      where: { providerMessageId, deliveredAt: null, readAt: null },
      data: { status: 'failed', errorMessage: error },
    });
  }
}
