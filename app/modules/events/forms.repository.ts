import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaRepositoryBase } from '@shared/prisma-repository.base';
import { FormFieldKind } from '@modules/events/form-fields.repository';

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
}
