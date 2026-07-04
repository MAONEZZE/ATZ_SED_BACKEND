import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MessageTemplatesRepository } from '@modules/messaging/message-templates.repository';

export interface CreateTemplateInput {
  name: string;
  channel: string;
  subject?: string;
  body: string;
  layoutConfig?: Record<string, unknown>;
  styleKey?: string;
  eventId?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  channel?: string;
  subject?: string;
  body?: string;
  layoutConfig?: Record<string, unknown>;
  styleKey?: string;
  eventId?: string | null;
}

@Injectable()
export class TemplatesService {
  constructor(private readonly repo: MessageTemplatesRepository) {}

  async create(userId: string, input: CreateTemplateInput) {
    if (input.eventId) await this.assertEventAccess(input.eventId, userId);
    return this.repo.create({
      ownerId: userId,
      name: input.name,
      channel: input.channel as Prisma.MessageTemplateUncheckedCreateInput['channel'],
      subject: input.subject,
      body: input.body,
      layoutConfig: this.toJson(input.layoutConfig),
      styleKey: input.styleKey ?? null,
      eventId: input.eventId ?? null,
    });
  }

  list(
    userId: string,
    eventId: string | undefined,
    page: number,
    limit: number,
    channel?: string,
  ) {
    const filter: Prisma.MessageTemplateWhereInput = {
      ...(eventId === 'null' ? { eventId: null } : eventId ? { eventId } : {}),
      ...(channel && { channel: channel as Prisma.MessageTemplateWhereInput['channel'] }),
    };
    return this.repo.findAllForOwnerPaginated(userId, filter, {
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findOne(userId: string, id: string) {
    const template = await this.repo.findByIdForOwner(id, userId);
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async update(userId: string, id: string, input: UpdateTemplateInput) {
    const existing = await this.findOne(userId, id);
    if (input.eventId) await this.assertEventAccess(input.eventId, userId);

    const resolvedChannel = input.channel ?? existing.channel;
    const resolvedSubject = input.subject !== undefined ? input.subject : existing.subject;
    if (resolvedChannel === 'email' && !resolvedSubject?.trim()) {
      throw new BadRequestException('subject é obrigatório para templates de email');
    }

    return this.repo.update(id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.channel !== undefined && {
        channel: input.channel as Prisma.MessageTemplateUncheckedUpdateInput['channel'],
      }),
      ...(input.subject !== undefined && { subject: input.subject }),
      ...(input.body !== undefined && { body: input.body }),
      ...(input.layoutConfig !== undefined && { layoutConfig: this.toJson(input.layoutConfig) }),
      ...(input.styleKey !== undefined && { styleKey: input.styleKey }),
      ...(input.eventId !== undefined && { eventId: input.eventId }),
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);
    await this.repo.delete(id);
  }

  private async assertEventAccess(eventId: string, userId: string): Promise<void> {
    const event = await this.repo.eventAccessible(eventId, userId);
    if (!event) throw new NotFoundException('Event not found');
  }

  private toJson(config: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    return config != null ? (config as Prisma.InputJsonValue) : Prisma.JsonNull;
  }
}
