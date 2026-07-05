import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Cron } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import {
  QUEUE_MESSAGE_DISPATCH,
  QUEUE_SCHEDULED_AUTOMATIONS,
} from '@infra/queue/bull-queues.module';

const DAY_MS = 24 * 60 * 60 * 1000;
const CLEAN_LIMIT = 10_000;

@Injectable()
export class RedisMaintenanceService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RedisMaintenanceService.name);

  constructor(
    @InjectQueue(QUEUE_MESSAGE_DISPATCH) private readonly dispatchQueue: Queue,
    @InjectQueue(QUEUE_SCHEDULED_AUTOMATIONS) private readonly automationsQueue: Queue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.cleanupQueues('bootstrap');
  }

  @Cron(process.env.REDIS_CLEANUP_CRON || '0 4 * * *')
  async scheduledCleanup(): Promise<void> {
    await this.cleanupQueues('cron');
  }

  async cleanupQueues(reason: string): Promise<void> {
    try {
      for (const queue of [this.dispatchQueue, this.automationsQueue]) {
        await queue.clean(0, CLEAN_LIMIT, 'completed');
        await queue.clean(DAY_MS, CLEAN_LIMIT, 'failed');
        await queue.trimEvents(queue.name === QUEUE_MESSAGE_DISPATCH ? 500 : 200);
      }
      this.logger.log(`Redis queue cleanup complete (${reason})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Redis queue cleanup failed (${reason}): ${msg}`);
    }
  }
}
