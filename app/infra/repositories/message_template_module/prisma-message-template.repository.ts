import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaRepositoryBase } from '@infra/repositories/shared/prisma-repository.base';
import { MessageChannel } from '@domain/shared/message-channel.type';
import { MessageTemplateEntity } from '@domain/message_template_module/message-template.entity';
import {
  CreateMessageTemplateData,
  MessageTemplateFilter,
  MessageTemplateRepositoryPort,
  UpdateMessageTemplateData,
} from '@domain/message_template_module/i-repository-message-template';

type MessageTemplateRow = {
  id: string;
  ownerId: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
  layoutConfig: Prisma.JsonValue;
  styleKey: string | null;
  eventId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaMessageTemplateRepository
  extends PrismaRepositoryBase
  implements MessageTemplateRepositoryPort
{
  private toEntity(row: MessageTemplateRow): MessageTemplateEntity {
    return new MessageTemplateEntity(
      row.id,
      row.ownerId,
      row.name,
      row.channel as MessageChannel,
      row.subject,
      row.body,
      row.layoutConfig && typeof row.layoutConfig === 'object'
        ? (row.layoutConfig as Record<string, unknown>)
        : null,
      row.styleKey,
      row.eventId,
      row.createdAt,
      row.updatedAt,
    );
  }

  /** `undefined` deixa a coluna intacta; `null` grava JSON null. */
  private toJson(config: Record<string, unknown> | null | undefined) {
    return config != null ? (config as Prisma.InputJsonValue) : Prisma.JsonNull;
  }

  /** Traduz o filtro semântico da porta para o `where` do Prisma. */
  private toWhere(
    ownerId: string,
    filter: MessageTemplateFilter,
  ): Prisma.MessageTemplateWhereInput {
    const channel = filter.channel && { channel: filter.channel };

    // Escopo de evento: os templates do evento (de qualquer dono, já que o
    // acesso ao evento foi verificado no service) mais os globais do usuário.
    if (typeof filter.eventId === 'string') {
      return {
        OR: [{ eventId: filter.eventId }, { ownerId, eventId: null }],
        ...channel,
      };
    }

    return {
      ownerId,
      ...(filter.eventId === null && { eventId: null }),
      ...channel,
    };
  }

  async create(data: CreateMessageTemplateData): Promise<MessageTemplateEntity> {
    const row = await this.prisma.messageTemplate.create({
      data: {
        ownerId: data.ownerId,
        name: data.name,
        channel: data.channel,
        subject: data.subject ?? null,
        body: data.body,
        layoutConfig: this.toJson(data.layoutConfig),
        styleKey: data.styleKey ?? null,
        eventId: data.eventId ?? null,
      },
    });
    return this.toEntity(row);
  }

  async findByIdForUser(id: string, userId: string): Promise<MessageTemplateEntity | null> {
    const row = await this.prisma.messageTemplate.findFirst({
      where: {
        id,
        OR: [
          { ownerId: userId },
          {
            event: {
              OR: [{ ownerId: userId }, { collaborators: { some: { profileId: userId } } }],
            },
          },
        ],
      },
    });
    return row ? this.toEntity(row) : null;
  }

  async findFirstForOwner(ownerId: string): Promise<MessageTemplateEntity | null> {
    const row = await this.prisma.messageTemplate.findFirst({ where: { ownerId } });
    return row ? this.toEntity(row) : null;
  }

  async findAllForOwnerPaginated(
    ownerId: string,
    filter: MessageTemplateFilter,
    pagination: { skip: number; take: number },
  ): Promise<{ data: MessageTemplateEntity[]; total: number }> {
    const where = this.toWhere(ownerId, filter);
    const [rows, total] = await Promise.all([
      this.prisma.messageTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.messageTemplate.count({ where }),
    ]);
    return { data: rows.map((row) => this.toEntity(row)), total };
  }

  async update(id: string, data: UpdateMessageTemplateData): Promise<MessageTemplateEntity> {
    const payload: Prisma.MessageTemplateUncheckedUpdateInput = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.channel !== undefined && { channel: data.channel }),
      ...(data.subject !== undefined && { subject: data.subject }),
      ...(data.body !== undefined && { body: data.body }),
      ...(data.layoutConfig !== undefined && { layoutConfig: this.toJson(data.layoutConfig) }),
      ...(data.styleKey !== undefined && { styleKey: data.styleKey }),
      ...(data.eventId !== undefined && { eventId: data.eventId }),
    };
    const row = await this.prisma.messageTemplate.update({ where: { id }, data: payload });
    return this.toEntity(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.messageTemplate.delete({ where: { id } });
  }

  /** True if the event exists and is owned by / shared with the user (for template linking). */
  async eventAccessible(eventId: string, userId: string): Promise<boolean> {
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        OR: [{ ownerId: userId }, { collaborators: { some: { profileId: userId } } }],
      },
      select: { id: true },
    });
    return event !== null;
  }
}
