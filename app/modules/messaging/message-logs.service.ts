import { Injectable } from '@nestjs/common';
import { MessageLogsRepository } from '@modules/messaging/message-logs.repository';

type LogRow = { deliveredAt?: Date | null; readAt?: Date | null } & Record<string, unknown>;

@Injectable()
export class MessageLogsService {
  constructor(private readonly repo: MessageLogsRepository) {}

  // Expõe booleanos derivados para o frontend não precisar interpretar timestamps.
  private withDeliveryFlags<T extends LogRow>(row: T) {
    return { ...row, delivered: Boolean(row.deliveredAt || row.readAt), read: Boolean(row.readAt) };
  }

  async listForEvent(eventId: string, page: number, limit: number) {
    const { data, total } = await this.repo.findByEventPaginated(eventId, {
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data: (data as LogRow[]).map((r) => this.withDeliveryFlags(r)), total };
  }

  async streamForEvent(eventId: string, take = 20) {
    const rows = await this.repo.streamByEvent(eventId, take);
    return (rows as LogRow[]).map((r) => this.withDeliveryFlags(r));
  }

  /** Logs across all the user's events plus messages they directly own. */
  async listForUser(userId: string, page: number, limit: number) {
    const { data, total } = await this.repo.findAllForUserPaginated(userId, {
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data: (data as LogRow[]).map((r) => this.withDeliveryFlags(r)), total };
  }
}
