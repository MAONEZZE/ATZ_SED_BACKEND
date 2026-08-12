import { Inject, Injectable } from '@nestjs/common';
import {
  POST_EVENT_RESPONSE_REPOSITORY_PORT,
  PostEventResponseRepositoryPort,
} from '@domain/post_event_response_module/i-repository-post-event-response';
import { CsvPostEventResponse } from '@application/post_event_response_module/post-event-response-csv';

@Injectable()
export class PostEventResponseService {
  constructor(
    @Inject(POST_EVENT_RESPONSE_REPOSITORY_PORT)
    private readonly repo: PostEventResponseRepositoryPort,
  ) {}

  listPaginated(eventId: string, page: number, limit: number) {
    return this.repo.findAllByEventPaginated(eventId, { skip: (page - 1) * limit, take: limit });
  }

  async exportRows(eventId: string): Promise<CsvPostEventResponse[]> {
    const responses = await this.repo.findAllByEvent(eventId);
    return responses.map(({ response, respondent }) => ({
      name: respondent.name,
      email: respondent.email,
      phone: respondent.phone,
      answers: response.answers,
      createdAt: response.createdAt,
    }));
  }
}
