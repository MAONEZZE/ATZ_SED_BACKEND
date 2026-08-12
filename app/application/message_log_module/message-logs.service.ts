import { Inject, Injectable } from '@nestjs/common';
import { MessageLogEntity } from '@domain/message_log_module/message-log.entity';
import {
  MESSAGE_LOG_REPOSITORY_PORT,
  MessageLogRepositoryPort,
} from '@domain/message_log_module/i-repository-message-log';

@Injectable()
export class MessageLogsService {
  constructor(
    @Inject(MESSAGE_LOG_REPOSITORY_PORT)
    private readonly repo: MessageLogRepositoryPort,
  ) {}

  // Expõe booleanos derivados para o frontend não precisar interpretar timestamps.
  // O spread preserva os campos da linha; `delivered`/`read` vêm da entidade,
  // que é quem sabe que "lido implica entregue".
  private withDeliveryFlags<T extends MessageLogEntity>(log: T) {
    return { ...log, delivered: log.isDelivered(), read: log.isRead() };
  }

  async listForEvent(eventId: string, page: number, limit: number) {
    const { data, total } = await this.repo.findByEventPaginated(eventId, {
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data: data.map((log) => this.withDeliveryFlags(log)), total };
  }

  async streamForEvent(eventId: string, take = 20) {
    const logs = await this.repo.streamByEvent(eventId, take);
    return logs.map((log) => this.withDeliveryFlags(log));
  }

  /** Logs across all the user's events plus messages they directly own. */
  async listForUser(userId: string, page: number, limit: number) {
    const { data, total } = await this.repo.findAllForUserPaginated(userId, {
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data: data.map((log) => this.withDeliveryFlags(log)), total };
  }
}
