import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FormEntity } from '@domain/form_module/form.entity';
import {
  FORM_REPOSITORY_PORT,
  FormRepositoryPort,
  UpdateFormData,
} from '@domain/form_module/i-repository-form';

export interface CreateFormInput {
  name: string;
  description?: string;
  postRegistrationMessage?: string;
  linkPostSubscription?: string;
  requireImageAuthorization?: boolean;
  sendToPipedrive?: boolean;
}

@Injectable()
export class FormService {
  constructor(@Inject(FORM_REPOSITORY_PORT) private readonly repo: FormRepositoryPort) {}

  list(eventId: string): Promise<FormEntity[]> {
    return this.repo.listByEvent(eventId);
  }

  /**
   * Formulário principal do evento: o de menor `order`. Sem os 3 tipos fixos, é
   * ele que representa "o formulário do evento" onde antes se assumia
   * `kind=registration` — página pública e colunas do CSV de inscritos.
   */
  async primary(eventId: string): Promise<FormEntity | null> {
    const forms = await this.repo.listByEvent(eventId);
    return forms[0] ?? null;
  }

  async findOne(id: string, eventId: string): Promise<FormEntity> {
    const form = await this.repo.findByIdAndEvent(id, eventId);
    if (!form) throw new NotFoundException('Form not found');
    return form;
  }

  /** O slug vem do nome e é a chave pública dentro do evento — daí o 409 no choque. */
  async create(eventId: string, input: CreateFormInput): Promise<FormEntity> {
    const slug = FormEntity.generateSlug(input.name);
    if (!slug) throw new BadRequestException('Nome do formulário inválido');
    if (await this.repo.findByEventAndSlug(eventId, slug)) {
      throw new ConflictException(`Já existe um formulário com o slug '${slug}' neste evento`);
    }
    return this.repo.create({ eventId, slug, ...input });
  }

  async update(id: string, eventId: string, input: UpdateFormData): Promise<FormEntity> {
    const form = await this.findOne(id, eventId);
    // Renomear reescreve o slug, então a URL pública do formulário muda junto.
    let slug: string | undefined;
    if (input.name !== undefined && input.name !== form.name) {
      slug = FormEntity.generateSlug(input.name);
      if (!slug) throw new BadRequestException('Nome do formulário inválido');
      const clash = await this.repo.findByEventAndSlug(eventId, slug);
      if (clash && clash.id !== id) {
        throw new ConflictException(`Já existe um formulário com o slug '${slug}' neste evento`);
      }
    }
    return this.repo.update(id, { ...input, ...(slug && { slug }) });
  }

  async delete(id: string, eventId: string): Promise<void> {
    await this.findOne(id, eventId);
    await this.repo.delete(id);
  }

  reorder(eventId: string, ids: string[]): Promise<void> {
    return this.repo.reorder(eventId, ids);
  }

  /** Resolução pública: slug do evento + slug do formulário. */
  async findPublic(eventSlug: string, formSlug: string): Promise<FormEntity> {
    const form = await this.repo.findByEventSlugAndFormSlug(eventSlug, formSlug);
    if (!form) throw new NotFoundException('Form not found');
    return form;
  }
}
