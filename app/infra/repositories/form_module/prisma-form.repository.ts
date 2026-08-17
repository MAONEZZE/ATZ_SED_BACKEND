import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaRepositoryBase } from '@infra/repositories/shared/prisma-repository.base';
import { EventDuplicationForm } from '@domain/event_module/i-repository-event';
import { FormEntity } from '@domain/form_module/form.entity';
import {
  CreateFormData,
  FormRepositoryPort,
  UpdateFormData,
} from '@domain/form_module/i-repository-form';

type FormRow = {
  id: string;
  eventId: string;
  name: string;
  slug: string;
  order: number;
  description: string | null;
  postRegistrationMessage: string | null;
  linkPostSubscription: string | null;
  requireImageAuthorization: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaFormRepository extends PrismaRepositoryBase implements FormRepositoryPort {
  private toEntity(row: FormRow): FormEntity {
    return new FormEntity(
      row.id,
      row.eventId,
      row.name,
      row.slug,
      row.order,
      row.description,
      row.postRegistrationMessage,
      row.linkPostSubscription,
      row.requireImageAuthorization,
      row.createdAt,
      row.updatedAt,
    );
  }

  async listByEvent(eventId: string): Promise<FormEntity[]> {
    const rows = await this.prisma.form.findMany({
      where: { eventId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findByIdAndEvent(id: string, eventId: string): Promise<FormEntity | null> {
    const row = await this.prisma.form.findFirst({ where: { id, eventId } });
    return row ? this.toEntity(row) : null;
  }

  async findByEventAndSlug(eventId: string, slug: string): Promise<FormEntity | null> {
    const row = await this.prisma.form.findUnique({ where: { eventId_slug: { eventId, slug } } });
    return row ? this.toEntity(row) : null;
  }

  // Resolve pela URL pública sem exigir o id do evento: o slug do evento é único.
  async findByEventSlugAndFormSlug(
    eventSlug: string,
    formSlug: string,
  ): Promise<FormEntity | null> {
    const row = await this.prisma.form.findFirst({
      where: { slug: formSlug, event: { slug: eventSlug } },
    });
    return row ? this.toEntity(row) : null;
  }

  async create(data: CreateFormData): Promise<FormEntity> {
    const last = await this.prisma.form.findFirst({
      where: { eventId: data.eventId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const row = await this.prisma.form.create({
      data: {
        eventId: data.eventId,
        name: data.name,
        slug: data.slug,
        order: last ? last.order + 1 : 0,
        description: data.description ?? null,
        postRegistrationMessage: data.postRegistrationMessage ?? null,
        linkPostSubscription: data.linkPostSubscription ?? null,
        ...(data.requireImageAuthorization !== undefined && {
          requireImageAuthorization: data.requireImageAuthorization,
        }),
      },
    });
    return this.toEntity(row);
  }

  /** Só as chaves presentes em `data` chegam ao banco. */
  async update(id: string, data: UpdateFormData): Promise<FormEntity> {
    const payload: Prisma.FormUncheckedUpdateInput = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.postRegistrationMessage !== undefined && {
        postRegistrationMessage: data.postRegistrationMessage,
      }),
      ...(data.linkPostSubscription !== undefined && {
        linkPostSubscription: data.linkPostSubscription,
      }),
      ...(data.requireImageAuthorization !== undefined && {
        requireImageAuthorization: data.requireImageAuthorization,
      }),
    };
    return this.toEntity(await this.prisma.form.update({ where: { id }, data: payload }));
  }

  // Campos e respostas saem por cascata da FK.
  async delete(id: string): Promise<void> {
    await this.prisma.form.delete({ where: { id } });
  }

  async reorder(eventId: string, ids: string[]): Promise<void> {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.form.updateMany({ where: { id, eventId }, data: { order: index } }),
      ),
    );
  }

  async createWithFields(eventId: string, form: EventDuplicationForm): Promise<FormEntity> {
    const row = await this.prisma.form.create({
      data: {
        eventId,
        name: form.name,
        slug: form.slug,
        order: form.order,
        description: form.description,
        postRegistrationMessage: form.postRegistrationMessage,
        linkPostSubscription: form.linkPostSubscription,
        fields: {
          create: form.fields.map((f) => ({
            label: f.label,
            type: f.type as Prisma.FormFieldUncheckedCreateInput['type'],
            required: f.required,
            options: f.options ?? undefined,
            order: f.order,
            isFixed: f.isFixed,
          })),
        },
      },
    });
    return this.toEntity(row);
  }
}
