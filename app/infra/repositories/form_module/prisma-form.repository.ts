import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaRepositoryBase } from '@infra/repositories/shared/prisma-repository.base';
import { FormKind } from '@domain/shared/form-kind.type';
import { EventDuplicationForm } from '@domain/event_module/i-repository-event';
import { FormEntity } from '@domain/form_module/form.entity';
import { FormRepositoryPort, UpdateFormData } from '@domain/form_module/i-repository-form';

@Injectable()
export class PrismaFormRepository extends PrismaRepositoryBase implements FormRepositoryPort {
  private toEntity(row: {
    id: string;
    eventId: string;
    kind: string;
    description: string | null;
    postRegistrationMessage: string | null;
    linkPostSubscription: string | null;
    requireImageAuthorization: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): FormEntity {
    return new FormEntity(
      row.id,
      row.eventId,
      row.kind as FormKind,
      row.description,
      row.postRegistrationMessage,
      row.linkPostSubscription,
      row.requireImageAuthorization,
      row.createdAt,
      row.updatedAt,
    );
  }

  async findByEventAndKind(eventId: string, kind: FormKind): Promise<FormEntity | null> {
    const row = await this.prisma.form.findUnique({
      where: { eventId_kind: { eventId, kind } },
    });
    return row ? this.toEntity(row) : null;
  }

  async create(eventId: string, kind: FormKind): Promise<FormEntity> {
    return this.toEntity(await this.prisma.form.create({ data: { eventId, kind } }));
  }

  /** Translates the port's optional-key contract into a Prisma update payload:
   * only keys present on `data` reach the database. */
  async update(id: string, data: UpdateFormData): Promise<FormEntity> {
    const payload: Prisma.FormUncheckedUpdateInput = {
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

  async createWithFields(eventId: string, form: EventDuplicationForm): Promise<FormEntity> {
    const row = await this.prisma.form.create({
      data: {
        eventId,
        kind: form.kind as FormKind,
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
