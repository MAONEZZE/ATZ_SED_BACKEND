import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  EVENT_REPOSITORY_PORT,
  EventRepositoryPort,
} from '@domain/event_module/i-repository-event';
import {
  COLLABORATOR_REPOSITORY_PORT,
  CollaboratorRepositoryPort,
} from '@domain/collaborator_module/i-repository-collaborator';
import {
  FOLDER_REPOSITORY_PORT,
  FolderRepositoryPort,
} from '@domain/folder_module/i-repository-folder';
import {
  WHATSAPP_INSTANCE_REPOSITORY_PORT,
  WhatsappInstanceRepositoryPort,
} from '@domain/whatsapp_instance_module/i-repository-whatsapp-instance';
import { STORAGE_PORT, StoragePort } from '@domain/shared/i-storage';
import { EventEntity, EventStatus } from '@domain/event_module/event.entity';
import { EventValidator } from '@domain/event_module/event.validator';
import { ConfigService } from '@nestjs/config';

export interface CreateEventInput {
  title: string;
  location?: string;
  capacity?: number;
  dressCode?: string;
  groupLink?: string;
  eventDate?: Date;
  endDate?: Date;
  sendToPipedrive?: boolean;
  recurrenceFreq?: string;
  recurrenceInterval?: number;
  recurrenceUntil?: Date;
  whatsappInstanceId?: string;
}

export interface UpdateEventInput {
  /** `null` tira o evento da pasta (volta para a raiz do painel). */
  folderId?: string | null;
  title?: string;
  location?: string;
  capacity?: number;
  dressCode?: string;
  groupLink?: string;
  eventDate?: Date;
  endDate?: Date;
  sendToPipedrive?: boolean;
  whatsappInstanceId?: string;
  whatsappToken?: string;
  recurrenceFreq?: string;
  recurrenceInterval?: number;
  recurrenceUntil?: Date;
}

@Injectable()
export class EventService {
  constructor(
    @Inject(EVENT_REPOSITORY_PORT) private readonly eventRepo: EventRepositoryPort,
    @Inject(COLLABORATOR_REPOSITORY_PORT)
    private readonly collaborators: CollaboratorRepositoryPort,
    @Inject(FOLDER_REPOSITORY_PORT) private readonly folders: FolderRepositoryPort,
    @Inject(WHATSAPP_INSTANCE_REPOSITORY_PORT)
    private readonly whatsappInstances: WhatsappInstanceRepositoryPort,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly config: ConfigService,
  ) {}

  async create(ownerId: string, input: CreateEventInput): Promise<EventEntity> {
    this.assertValidPeriod(input.eventDate, input.endDate);
    return this.eventRepo.create({ ...input, ownerId });
  }

  async findAll(ownerId: string): Promise<EventEntity[]> {
    return this.eventRepo.findAllByOwner(ownerId);
  }

  async findAllPaginated(
    ownerId: string,
    page: number,
    limit: number,
    folderId?: string | null,
  ): Promise<{ data: EventEntity[]; total: number }> {
    return this.eventRepo.findAllByOwnerPaginated(
      ownerId,
      { skip: (page - 1) * limit, take: limit },
      folderId,
    );
  }

  reorder(ownerId: string, folderId: string | null, ids: string[]): Promise<void> {
    return this.eventRepo.reorder(ownerId, folderId, ids);
  }

  async findById(id: string): Promise<EventEntity> {
    const event = await this.eventRepo.findById(id);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async findBySlug(slug: string): Promise<EventEntity> {
    const event = await this.eventRepo.findBySlug(slug);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async update(id: string, input: UpdateEventInput, editorId?: string): Promise<EventEntity> {
    const event = await this.findById(id);
    if (!event.isEditable()) {
      throw new ForbiddenException('Cancelled or ended events cannot be edited');
    }
    this.assertValidPeriod(input.eventDate ?? event.eventDate, input.endDate ?? event.endDate);
    // Pasta de evento é organização pessoal do painel: nem pasta de outra conta,
    // nem pasta de template/automação, nem pasta que mora dentro de um evento.
    // Sem isso um id conhecido moveria o evento para a pasta errada.
    if (input.folderId && editorId) {
      const folder = await this.folders.findById(input.folderId);
      if (
        !folder ||
        folder.ownerId !== editorId ||
        folder.resourceType !== 'event' ||
        folder.eventId !== null
      ) {
        throw new NotFoundException('Folder not found');
      }
    }
    // Vincular instância ao evento é o outro caminho para disparar por ela:
    // vale a mesma lista fixa do usuário.
    if (input.whatsappInstanceId && editorId) {
      const allowed = await this.whatsappInstances.isAllowedForProfile(
        input.whatsappInstanceId,
        editorId,
      );
      if (!allowed) {
        throw new ForbiddenException(
          'Esta instância WhatsApp não está liberada para o seu usuário',
        );
      }
    }
    return this.eventRepo.update(id, editorId ? { ...input, lastEditedById: editorId } : input);
  }

  private assertValidPeriod(eventDate?: Date, endDate?: Date): void {
    const errors = new EventValidator().validate({ eventDate, endDate });
    if (errors.length > 0) throw new BadRequestException(errors[0]);
  }

  async updateStatus(
    id: string,
    status: EventStatus,
    editorId?: string,
  ): Promise<EventEntity> {
    const event = await this.findById(id);
    if (!event.canTransitionTo(status)) {
      throw new BadRequestException(`Cannot transition from '${event.status}' to '${status}'`);
    }
    return this.eventRepo.updateStatus(id, status, editorId);
  }

  async uploadCover(
    id: string,
    file: Buffer,
    mimeType: string,
    editorId?: string,
  ): Promise<EventEntity> {
    await this.findById(id);
    const bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'ATZ_SED';
    const folder = this.config.get<string>('SUPABASE_STORAGE_BUCKET_COVERS') ?? 'event-covers';
    const path = `${folder}/${id}/cover`;
    const { url } = await this.storage.upload(bucket, path, file, mimeType);
    return this.eventRepo.update(
      id,
      editorId ? { coverUrl: url, lastEditedById: editorId } : { coverUrl: url },
    );
  }

  async deleteCover(id: string, editorId?: string): Promise<EventEntity> {
    const event = await this.findById(id);
    if (event.coverUrl) {
      const bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'ATZ_SED';
      const folder = this.config.get<string>('SUPABASE_STORAGE_BUCKET_COVERS') ?? 'event-covers';
      const path = `${folder}/${id}/cover`;
      try {
        await this.storage.delete(bucket, path);
      } catch {}
    }
    return this.eventRepo.update(
      id,
      editorId ? { coverUrl: null, lastEditedById: editorId } : { coverUrl: null },
    );
  }

  /**
   * Dono e `admin` apagam o evento. Para `invited` e `read`, deletar significa
   * "tirar do meu painel": remove o próprio vínculo e o evento continua vivo
   * para os outros.
   */
  async delete(id: string, userId: string): Promise<{ deleted: boolean }> {
    await this.findById(id);
    const ownership = await this.eventRepo.findOwnershipById(id, userId);
    if (!ownership?.role) throw new ForbiddenException('Not your event');

    if (ownership.ownerId === userId || ownership.role === 'admin') {
      await this.eventRepo.delete(id);
      return { deleted: true };
    }

    await this.collaborators.remove(id, userId);
    return { deleted: false };
  }
}
