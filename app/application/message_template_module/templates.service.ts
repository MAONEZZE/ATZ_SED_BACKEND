import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { MessageChannel } from '@domain/shared/message-channel.type';
import { MessageTemplateEntity } from '@domain/message_template_module/message-template.entity';
import {
  MESSAGE_TEMPLATE_REPOSITORY_PORT,
  MessageTemplateFilter,
  MessageTemplateRepositoryPort,
} from '@domain/message_template_module/i-repository-message-template';

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
  constructor(
    @Inject(MESSAGE_TEMPLATE_REPOSITORY_PORT)
    private readonly repo: MessageTemplateRepositoryPort,
  ) {}

  async create(userId: string, input: CreateTemplateInput) {
    if (input.eventId) await this.assertEventAccess(input.eventId, userId);
    return this.repo.create({
      ownerId: userId,
      name: input.name,
      channel: input.channel as MessageChannel,
      subject: input.subject,
      body: input.body,
      layoutConfig: input.layoutConfig,
      styleKey: input.styleKey ?? null,
      eventId: input.eventId ?? null,
    });
  }

  list(userId: string, eventId: string | undefined, page: number, limit: number, channel?: string) {
    // A query string carrega a literal 'null' para pedir só os templates
    // globais; o filtro da porta distingue isso de "sem filtro" (undefined).
    const filter: MessageTemplateFilter = {
      ...(eventId === 'null' ? { eventId: null } : eventId ? { eventId } : {}),
      ...(channel && { channel: channel as MessageChannel }),
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

    // O patch é parcial, então a regra vale sobre o resultado da mesclagem, não
    // sobre o que veio no corpo: trocar só o canal para email sem assunto no
    // template existente também é inválido.
    const resolvedChannel = (input.channel ?? existing.channel) as MessageChannel;
    const resolvedSubject = input.subject !== undefined ? input.subject : existing.subject;
    if (MessageTemplateEntity.requiresSubject(resolvedChannel, resolvedSubject)) {
      throw new BadRequestException('subject é obrigatório para templates de email');
    }

    return this.repo.update(id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.channel !== undefined && { channel: input.channel as MessageChannel }),
      ...(input.subject !== undefined && { subject: input.subject }),
      ...(input.body !== undefined && { body: input.body }),
      ...(input.layoutConfig !== undefined && { layoutConfig: input.layoutConfig }),
      ...(input.styleKey !== undefined && { styleKey: input.styleKey }),
      ...(input.eventId !== undefined && { eventId: input.eventId }),
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id);
    await this.repo.delete(id);
  }

  private async assertEventAccess(eventId: string, userId: string): Promise<void> {
    const accessible = await this.repo.eventAccessible(eventId, userId);
    if (!accessible) throw new NotFoundException('Event not found');
  }
}
