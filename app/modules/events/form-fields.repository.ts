import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaRepositoryBase } from '@shared/prisma-repository.base';

export type FormFieldKind = 'registration' | 'post_event' | 'nps';

@Injectable()
export class FormFieldsRepository extends PrismaRepositoryBase {
  async findAllByEventPaginated(
    eventId: string,
    kind: FormFieldKind | undefined,
    pagination: { skip: number; take: number },
  ): Promise<{ data: object[]; total: number }> {
    const where = { form: { eventId, ...(kind ? { kind } : {}) } };
    const [data, total] = await Promise.all([
      this.prisma.formField.findMany({
        where,
        orderBy: { order: 'asc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.formField.count({ where }),
    ]);
    return { data, total };
  }

  findByEvent(eventId: string, id: string) {
    return this.prisma.formField.findFirst({ where: { id, form: { eventId } } });
  }

  /** Ordered labels of a kind, optionally only the dynamic (non-fixed) ones — used for CSV headers. */
  listLabels(eventId: string, kind: FormFieldKind, onlyDynamic = false) {
    return this.prisma.formField.findMany({
      where: { form: { eventId, kind }, ...(onlyDynamic ? { isFixed: false } : {}) },
      orderBy: { order: 'asc' },
      select: { label: true },
    });
  }

  /** Field metadata used to validate submitted answers. */
  listValidationFields(eventId: string, kind: FormFieldKind) {
    return this.prisma.formField.findMany({
      where: { form: { eventId, kind } },
      select: { label: true, type: true, required: true, isFixed: true, options: true },
    });
  }

  create(data: Prisma.FormFieldUncheckedCreateInput) {
    return this.prisma.formField.create({ data });
  }

  update(id: string, data: Prisma.FormFieldUncheckedUpdateInput) {
    return this.prisma.formField.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.formField.delete({ where: { id } });
  }

  /** Stamps the last editor on the parent event (event + its form scope). */
  touchEvent(eventId: string, userId: string) {
    return this.prisma.event.update({ where: { id: eventId }, data: { lastEditedById: userId } });
  }
}
