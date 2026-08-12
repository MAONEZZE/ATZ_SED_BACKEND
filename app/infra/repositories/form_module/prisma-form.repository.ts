import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaRepositoryBase } from '@infra/repositories/shared/prisma-repository.base';
import { FormKind } from '@domain/shared/form-kind.type';
import { EventDuplicationForm } from '@domain/event_module/i-repository-event';
import { FormRepositoryPort, FormRow, UpdateFormData } from '@domain/form_module/i-repository-form';

@Injectable()
export class PrismaFormRepository extends PrismaRepositoryBase implements FormRepositoryPort {
  findByEventAndKind(eventId: string, kind: FormKind): Promise<FormRow | null> {
    return this.prisma.form.findUnique({ where: { eventId_kind: { eventId, kind } } });
  }

  create(eventId: string, kind: FormKind): Promise<FormRow> {
    return this.prisma.form.create({ data: { eventId, kind } });
  }

  /** Translates the port's optional-key contract into a Prisma update payload:
   * only keys present on `data` reach the database. */
  update(id: string, data: UpdateFormData): Promise<FormRow> {
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
    return this.prisma.form.update({ where: { id }, data: payload });
  }

  createWithFields(eventId: string, form: EventDuplicationForm): Promise<FormRow> {
    return this.prisma.form.create({
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
  }
}
