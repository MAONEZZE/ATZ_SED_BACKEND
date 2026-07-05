import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaRepositoryBase } from '@shared/prisma-repository.base';

@Injectable()
export class MessageTemplatesRepository extends PrismaRepositoryBase {
  create(data: Prisma.MessageTemplateUncheckedCreateInput) {
    return this.prisma.messageTemplate.create({ data });
  }

  findByIdForOwner(id: string, ownerId: string) {
    return this.prisma.messageTemplate.findFirst({ where: { id, ownerId } });
  }

  async findAllForOwnerPaginated(
    ownerId: string,
    eventFilter: Prisma.MessageTemplateWhereInput,
    pagination: { skip: number; take: number },
  ): Promise<{ data: object[]; total: number }> {
    const where: Prisma.MessageTemplateWhereInput = { ownerId, ...eventFilter };
    const [data, total] = await Promise.all([
      this.prisma.messageTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.messageTemplate.count({ where }),
    ]);
    return { data, total };
  }

  update(id: string, data: Prisma.MessageTemplateUncheckedUpdateInput) {
    return this.prisma.messageTemplate.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.messageTemplate.delete({ where: { id } });
  }

  /** True if the event exists and is owned by / shared with the user (for template linking). */
  eventAccessible(eventId: string, userId: string) {
    return this.prisma.event.findFirst({
      where: {
        id: eventId,
        OR: [{ ownerId: userId }, { collaborators: { some: { profileId: userId } } }],
      },
      select: { id: true },
    });
  }
}
