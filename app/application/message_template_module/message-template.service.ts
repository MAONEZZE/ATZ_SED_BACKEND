import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { MessageChannel } from '@domain/shared/message-channel.type';
import { MessageTemplateValidator } from '@domain/message_template_module/message-template.validator';
import {
  MESSAGE_TEMPLATE_REPOSITORY_PORT,
  MessageTemplateFilter,
  MessageTemplateRepositoryPort,
} from '@domain/message_template_module/i-repository-message-template';
import {
  FOLDER_REPOSITORY_PORT,
  FolderRepositoryPort,
} from '@domain/folder_module/i-repository-folder';

export interface CreateTemplateInput {
  name: string;
  channel: string;
  subject?: string;
  body: string;
  layoutConfig?: Record<string, unknown>;
  styleKey?: string;
  eventId?: string;
  folderId?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  channel?: string;
  subject?: string;
  body?: string;
  layoutConfig?: Record<string, unknown>;
  styleKey?: string;
  eventId?: string | null;
  folderId?: string | null;
}

@Injectable()
export class MessageTemplateService {
  constructor(
    @Inject(MESSAGE_TEMPLATE_REPOSITORY_PORT)
    private readonly repo: MessageTemplateRepositoryPort,
    @Inject(FOLDER_REPOSITORY_PORT)
    private readonly folders: FolderRepositoryPort,
  ) {}

  async create(userId: string, input: CreateTemplateInput) {
    if (input.eventId) await this.assertEventAccess(input.eventId, userId);
    if (input.folderId) {
      await this.assertFolderMatches(input.folderId, userId, input.eventId ?? null);
    }
    return this.repo.create({
      ownerId: userId,
      name: input.name,
      channel: input.channel as MessageChannel,
      subject: input.subject,
      body: input.body,
      layoutConfig: input.layoutConfig,
      styleKey: input.styleKey ?? null,
      eventId: input.eventId ?? null,
      folderId: input.folderId ?? null,
    });
  }

  async list(
    userId: string,
    eventId: string | undefined,
    page: number,
    limit: number,
    channel?: string,
    folderId?: string,
  ) {
    // A query string carrega a literal 'null' para pedir só os templates
    // globais (ou só os fora de pasta); o filtro da porta distingue isso de
    // "sem filtro" (undefined).
    if (eventId && eventId !== 'null') await this.assertEventAccess(eventId, userId);
    const filter: MessageTemplateFilter = {
      ...(eventId === 'null' ? { eventId: null } : eventId ? { eventId } : {}),
      ...(folderId === 'null' ? { folderId: null } : folderId ? { folderId } : {}),
      ...(channel && { channel: channel as MessageChannel }),
    };
    return this.repo.findAllForOwnerPaginated(userId, filter, {
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  /** `folderId` null reordena os templates que estão fora de pasta. */
  async reorder(userId: string, folderId: string | null, ids: string[]): Promise<void> {
    if (folderId) await this.loadFolder(folderId, userId);
    await this.repo.reorder(userId, folderId, ids);
  }

  async move(userId: string, id: string, beforeId?: string): Promise<void> {
    const moved = await this.repo.move(userId, id, beforeId);
    if (!moved) throw new NotFoundException('Template not found');
  }

  async findOne(userId: string, id: string) {
    const template = await this.repo.findByIdForUser(id, userId);
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
    const errors = new MessageTemplateValidator().validate({
      channel: resolvedChannel,
      subject: resolvedSubject,
    });
    if (errors.length > 0) throw new BadRequestException(errors[0]);

    const resolvedFolderId = await this.resolveFolderId(userId, input, existing);

    return this.repo.update(id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.channel !== undefined && { channel: input.channel as MessageChannel }),
      ...(input.subject !== undefined && { subject: input.subject }),
      ...(input.body !== undefined && { body: input.body }),
      ...(input.layoutConfig !== undefined && { layoutConfig: input.layoutConfig }),
      ...(input.styleKey !== undefined && { styleKey: input.styleKey }),
      ...(input.eventId !== undefined && { eventId: input.eventId }),
      ...(resolvedFolderId !== undefined && { folderId: resolvedFolderId }),
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

  /**
   * Carrega uma pasta de template que o usuário alcança. Pasta do painel exige
   * ser dele; pasta que mora num evento exige acesso ao evento. Pasta de outro
   * tipo não serve para template.
   */
  private async loadFolder(folderId: string, userId: string) {
    const folder = await this.folders.findById(folderId);
    if (!folder || folder.resourceType !== 'message_template') {
      throw new NotFoundException('Folder not found');
    }
    if (folder.eventId === null) {
      if (folder.ownerId !== userId) throw new NotFoundException('Folder not found');
    } else {
      await this.assertEventAccess(folder.eventId, userId);
    }
    return folder;
  }

  /**
   * A pasta tem que ter o MESMO escopo de evento do template: pasta do evento X
   * não organiza template global nem template do evento Y.
   */
  private async assertFolderMatches(
    folderId: string,
    userId: string,
    eventId: string | null,
  ): Promise<void> {
    const folder = await this.loadFolder(folderId, userId);
    if (folder.eventId !== eventId) throw new NotFoundException('Folder not found');
  }

  /**
   * Qual `folderId` gravar no patch. `undefined` significa não tocar na coluna.
   *
   * A pegadinha é o patch parcial: se o template muda de evento e o corpo não
   * fala de pasta, ele ficaria preso numa pasta do evento antigo. Nesse caso a
   * pasta é limpa.
   */
  private async resolveFolderId(
    userId: string,
    input: UpdateTemplateInput,
    existing: { eventId: string | null; folderId: string | null },
  ): Promise<string | null | undefined> {
    const eventChanged = input.eventId !== undefined && input.eventId !== existing.eventId;

    if (input.folderId === undefined) {
      return eventChanged && existing.folderId !== null ? null : undefined;
    }
    if (input.folderId === null) return null;

    const eventId = input.eventId !== undefined ? input.eventId : existing.eventId;
    await this.assertFolderMatches(input.folderId, userId, eventId);
    return input.folderId;
  }
}
