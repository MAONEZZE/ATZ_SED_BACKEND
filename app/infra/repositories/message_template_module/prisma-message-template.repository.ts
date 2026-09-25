import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaRepositoryBase } from '@infra/repositories/shared/prisma-repository.base';
import { MessageChannel } from '@domain/shared/message-channel.type';
import { resequence } from '@domain/shared/resequence';
import { writesFor } from '@infra/repositories/shared/order-writes';
import { MessageTemplateEntity } from '@domain/message_template_module/message-template.entity';
import {
  CreateMessageTemplateData,
  MessageTemplateFilter,
  MessageTemplateRepositoryPort,
  UpdateMessageTemplateData,
} from '@domain/message_template_module/i-repository-message-template';
import { StoredAttachment } from '@domain/shared/file-reference';

type MessageTemplateRow = {
  id: string;
  ownerId: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
  layoutConfig: Prisma.JsonValue;
  styleKey: string | null;
  attachment: Prisma.JsonValue;
  eventId: string | null;
  folderId: string | null;
  order: number;
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
      row.attachment && typeof row.attachment === 'object'
        ? (row.attachment as unknown as StoredAttachment)
        : null,
      row.eventId,
      row.folderId,
      row.order,
      row.createdAt,
      row.updatedAt,
    );
  }

  /** `undefined` deixa a coluna intacta; `null` grava JSON null. */
  private toJson(config: Record<string, unknown> | null | undefined) {
    return config != null ? (config as Prisma.InputJsonValue) : Prisma.JsonNull;
  }

  /**
   * Quem alcança o template: o dono dele, ou quem é dono/colaborador do evento
   * ao qual ele está vinculado.
   */
  private accessibleWhere(userId: string): Prisma.MessageTemplateWhereInput {
    return {
      OR: [
        { ownerId: userId },
        {
          event: {
            OR: [{ ownerId: userId }, { collaborators: { some: { profileId: userId } } }],
          },
        },
      ],
    };
  }

  /** Traduz o filtro semântico da porta para o `where` do Prisma. */
  private toWhere(
    ownerId: string,
    filter: MessageTemplateFilter,
  ): Prisma.MessageTemplateWhereInput {
    const channel = filter.channel && { channel: filter.channel };
    const folder = filter.folderId !== undefined && { folderId: filter.folderId };

    // Escopo de evento: os templates do evento (de qualquer dono, já que o
    // acesso ao evento foi verificado no service) mais os globais do usuário.
    if (typeof filter.eventId === 'string') {
      return {
        OR: [{ eventId: filter.eventId }, { ownerId, eventId: null }],
        ...channel,
        ...folder,
      };
    }

    return {
      ownerId,
      ...(filter.eventId === null && { eventId: null }),
      ...channel,
      ...folder,
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
        attachment: data.attachment
          ? (data.attachment as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        eventId: data.eventId ?? null,
        folderId: data.folderId ?? null,
      },
    });
    return this.toEntity(row);
  }

  async findByIdForUser(id: string, userId: string): Promise<MessageTemplateEntity | null> {
    const row = await this.prisma.messageTemplate.findFirst({
      where: { id, ...this.accessibleWhere(userId) },
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
        // `order` vem primeiro por causa do drag & drop dentro da pasta; como
        // toda linha nasce com 0, a ordem de antes (createdAt desc) se mantém
        // até alguém reordenar de verdade.
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
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
      ...(data.attachment !== undefined && {
        attachment: data.attachment
          ? (data.attachment as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      }),
      ...(data.eventId !== undefined && { eventId: data.eventId }),
      ...(data.folderId !== undefined && { folderId: data.folderId }),
    };
    const row = await this.prisma.messageTemplate.update({ where: { id }, data: payload });
    return this.toEntity(row);
  }

  // A pasta entra no `where` como guarda: id que está em outra pasta não é
  // atualizado, em vez de ser reordenado no escopo errado.
  async reorder(userId: string, folderId: string | null, ids: string[]): Promise<void> {
    const scope = { folderId, ...this.accessibleWhere(userId) };
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.messageTemplate.updateMany({
          where: { id, ...scope },
          data: { order: index },
        }),
      ),
    );
  }

  // Arrasto item a item: o front manda só a âncora, não a lista da página.
  async move(userId: string, id: string, beforeId?: string): Promise<boolean> {
    const item = await this.prisma.messageTemplate.findFirst({
      where: { id, ...this.accessibleWhere(userId) },
      select: { folderId: true },
    });
    if (!item) return false;

    const rows = await this.prisma.messageTemplate.findMany({
      where: { folderId: item.folderId, ...this.accessibleWhere(userId) },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, order: true },
    });
    if (beforeId && !rows.some((r) => r.id === beforeId)) return false;

    const sequence = resequence(
      rows.map((r) => r.id),
      id,
      beforeId,
    );
    await this.prisma.$transaction(
      writesFor(rows, sequence).map(({ id: rowId, order }) =>
        this.prisma.messageTemplate.update({ where: { id: rowId }, data: { order } }),
      ),
    );
    return true;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.messageTemplate.delete({ where: { id } });
  }

  async isAttachmentPathReferenced(path: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ referenced: boolean }>>(Prisma.sql`
      SELECT (
        EXISTS (
          SELECT 1
          FROM "SED"."message_templates" mt
          WHERE mt."attachment"->>'path' = ${path}
        ) OR EXISTS (
          SELECT 1
          FROM "SED"."outbox_messages" om,
               jsonb_array_elements(
                 CASE
                   WHEN jsonb_typeof(om."attachments") = 'array' THEN om."attachments"
                   ELSE '[]'::jsonb
                 END
               ) attachment
          WHERE om."status" IN ('pending', 'processing')
            AND attachment->>'path' = ${path}
        )
      ) AS referenced
    `);
    return rows[0]?.referenced ?? false;
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
