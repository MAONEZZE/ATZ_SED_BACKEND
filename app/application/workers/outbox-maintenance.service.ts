import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  OUTBOX_REPOSITORY_PORT,
  OutboxRepositoryPort,
} from '@domain/outbox_module/i-repository-outbox';

const PRUNE_DAYS = 180; // MessageLog é a trilha durável; outbox é só operacional.

@Injectable()
export class OutboxMaintenanceService {
  private readonly logger = new Logger(OutboxMaintenanceService.name);

  constructor(@Inject(OUTBOX_REPOSITORY_PORT) private readonly outbox: OutboxRepositoryPort) {}

  @Cron(process.env.OUTBOX_PRUNE_CRON || '0 5 * * *') // deslocado do Redis (4am)
  async prune(): Promise<void> {
    const cutoff = new Date(Date.now() - PRUNE_DAYS * 24 * 60 * 60 * 1000);
    try {
      const count = await this.outbox.deleteSentOlderThan(cutoff);
      this.logger.log(`Outbox pruned: ${count} linha(s) sent com mais de ${PRUNE_DAYS}d removida(s)`);
    } catch (err) {
      this.logger.error({ err }, 'Outbox prune falhou');
    }
  }
}
