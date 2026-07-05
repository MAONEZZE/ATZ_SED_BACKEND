import { Injectable } from '@nestjs/common';
import { PrismaRepositoryBase } from '@shared/prisma-repository.base';

@Injectable()
export class PostEventResponsesRepository extends PrismaRepositoryBase {
  async findAllByEventPaginated(
    eventId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ data: object[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma.postEventResponse.findMany({
        where: { eventId },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
        include: {
          registration: { select: { id: true, name: true, email: true, phone: true } },
        },
      }),
      this.prisma.postEventResponse.count({ where: { eventId } }),
    ]);
    return { data, total };
  }

  findAllByEvent(eventId: string) {
    return this.prisma.postEventResponse.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
      include: { registration: { select: { name: true, email: true, phone: true } } },
    });
  }
}
