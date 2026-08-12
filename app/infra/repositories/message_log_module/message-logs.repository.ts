import { Injectable } from '@nestjs/common';
import { PrismaRepositoryBase } from '@infra/repositories/shared/prisma-repository.base';
import type { MessageChannel } from '@domain/shared/message-channel.type';

export interface CreateMessageLogData {
  eventId: string | null;
  ownerId: string | null;
  registrationId: string | null;
  channel: MessageChannel;
  recipient: string;
  body: string;
  status: string;
  providerMessageId?: string | null;
  sentAt?: Date;
  errorMessage?: string;
}

@Injectable()
export class MessageLogsRepository extends PrismaRepositoryBase {
  async create(data: CreateMessageLogData): Promise<void> {
    await this.prisma.messageLog.create({ data });
  }

  async findByEventPaginated(
    eventId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ data: object[]; total: number }> {
    const where = { OR: [{ eventId }, { eventId: null, registration: { eventId } }] };
    const [data, total] = await Promise.all([
      this.prisma.messageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.messageLog.count({ where }),
    ]);
    return { data, total };
  }

  streamByEvent(eventId: string, take: number) {
    return this.prisma.messageLog.findMany({
      where: { OR: [{ eventId }, { eventId: null, registration: { eventId } }] },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async findAllForUserPaginated(
    userId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ data: object[]; total: number }> {
    const where = {
      OR: [
        { event: { OR: [{ ownerId: userId }, { collaborators: { some: { profileId: userId } } }] } },
        { ownerId: userId },
      ],
    };
    const [data, total] = await Promise.all([
      this.prisma.messageLog.findMany({
        where,
        include: { event: { select: { id: true, title: true } } },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.messageLog.count({ where }),
    ]);
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
