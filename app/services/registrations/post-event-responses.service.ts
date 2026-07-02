import { Injectable } from '@nestjs/common';
import { PostEventResponsesRepository } from '@database/registrations/post-event-responses.repository';
import { CsvPostEventResponse } from '@services/registrations/post-event-responses-csv';

@Injectable()
export class PostEventResponsesService {
  constructor(private readonly repo: PostEventResponsesRepository) {}

  listPaginated(eventId: string, page: number, limit: number) {
    return this.repo.findAllByEventPaginated(eventId, { skip: (page - 1) * limit, take: limit });
  }

  async exportRows(eventId: string): Promise<CsvPostEventResponse[]> {
    const responses = await this.repo.findAllByEvent(eventId);
    return responses.map((r) => ({
      name: r.registration.name,
      email: r.registration.email,
      phone: r.registration.phone,
      answers: (r.answers ?? {}) as Record<string, unknown>,
      createdAt: r.createdAt,
    }));
  }
}
