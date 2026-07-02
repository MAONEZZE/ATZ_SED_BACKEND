import { Injectable } from '@nestjs/common';
import { PrismaRepositoryBase } from '@shared/prisma-repository.base';

@Injectable()
export class MessageLogsRepository extends PrismaRepositoryBase {
  async findByEventPaginated(
    eventId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ data: object[]; total: number }> {
    const where = { OR: [{ eventId }, { eventId: null, registration: { eventId } }] };
    const [data, total] = await Promise.all([
      this.prisma.messageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.messageLog.count({ where }),
    ]);
    return { data, total };
  }

  streamByEvent(eventId: string, take: number) {
    return this.prisma.messageLog.findMany({
      where: { OR: [{ eventId }, { eventId: null, registration: { eventId } }] },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async findAllForUserPaginated(
    userId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ data: object[]; total: number }> {
    const where = {
      OR: [
        { event: { OR: [{ ownerId: userId }, { collaborators: { some: { profileId: userId } } }] } },
        { ownerId: userId },
      ],
    };
    const [data, total] = await Promise.all([
      this.prisma.messageLog.findMany({
        where,
        include: { event: { select: { id: true, title: true } } },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.messageLog.count({ where }),
    ]);
    return { data, total };
  }
}
