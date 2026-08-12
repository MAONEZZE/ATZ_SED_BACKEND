import { Injectable } from '@nestjs/common';
import { PrismaRepositoryBase } from '@infra/repositories/shared/prisma-repository.base';
import { PostEventResponseEntity } from '@domain/post_event_response_module/post-event-response.entity';
import {
  PostEventResponseListItem,
  PostEventResponseRepositoryPort,
  PostEventResponseWithRespondent,
} from '@domain/post_event_response_module/i-repository-post-event-response';

@Injectable()
export class PrismaPostEventResponseRepository
  extends PrismaRepositoryBase
  implements PostEventResponseRepositoryPort
{
  async findAllByEventPaginated(
    eventId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ data: PostEventResponseListItem[]; total: number }> {
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

  async findAllByEvent(eventId: string): Promise<PostEventResponseWithRespondent[]> {
    const rows = await this.prisma.postEventResponse.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
      include: { registration: { select: { name: true, email: true, phone: true } } },
    });

    return rows.map((row) => ({
      response: new PostEventResponseEntity(
        row.id,
        row.eventId,
        row.registrationId,
        row.answers,
        row.createdAt,
        row.updatedAt,
      ),
      respondent: {
        name: row.registration.name,
        email: row.registration.email,
        phone: row.registration.phone,
      },
    }));
  }
}
