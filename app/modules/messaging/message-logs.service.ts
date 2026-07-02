import { Injectable } from '@nestjs/common';
import { MessageLogsRepository } from '@modules/messaging/message-logs.repository';

@Injectable()
export class MessageLogsService {
  constructor(private readonly repo: MessageLogsRepository) {}

  listForEvent(eventId: string, page: number, limit: number) {
    return this.repo.findByEventPaginated(eventId, { skip: (page - 1) * limit, take: limit });
  }

  streamForEvent(eventId: string, take = 20) {
    return this.repo.streamByEvent(eventId, take);
  }

  /** Logs across all the user's events plus messages they directly own. */
  listForUser(userId: string, page: number, limit: number) {
    return this.repo.findAllForUserPaginated(userId, { skip: (page - 1) * limit, take: limit });
  }
}
