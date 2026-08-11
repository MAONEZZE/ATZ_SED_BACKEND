import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaRepositoryBase } from '@shared/prisma-repository.base';
import { FormFieldKind } from '@modules/events/form-fields.repository';
import { EventDuplicationForm } from '@modules/events/ports/event-repository.port';

@Injectable()
export class FormsRepository extends PrismaRepositoryBase {
  findByEventAndKind(eventId: string, kind: FormFieldKind) {
    return this.prisma.form.findUnique({ where: { eventId_kind: { eventId, kind } } });
  }

  create(eventId: string, kind: FormFieldKind) {
    return this.prisma.form.create({ data: { eventId, kind } });
  }

  update(id: string, data: Prisma.FormUncheckedUpdateInput) {
    return this.prisma.form.update({ where: { id }, data });
  }

  createWithFields(eventId: string, form: EventDuplicationForm) {
    return this.prisma.form.create({
      data: {
        eventId,
        kind: form.kind as FormFieldKind,
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
