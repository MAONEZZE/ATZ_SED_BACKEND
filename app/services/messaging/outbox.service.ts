import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  OUTBOX_REPOSITORY_PORT,
  OutboxRepositoryPort,
  EnqueueMessageData,
} from '@domain/messaging/ports/outbox-repository.port';
import { QUEUE_MESSAGE_DISPATCH } from '@database/queue/bull-queues.module';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    @Inject(OUTBOX_REPOSITORY_PORT)
    private readonly outboxRepo: OutboxRepositoryPort,
    @InjectQueue(QUEUE_MESSAGE_DISPATCH) private readonly dispatchQueue: Queue,
  ) {}

  async enqueue(data: EnqueueMessageData): Promise<void> {
    await this.outboxRepo.enqueue(data);

    // Use deterministic jobId to deduplicate in BullMQ as well
    const jobId = `${data.registrationId}:${data.templateId}:${data.trigger}`;
    try {
      await this.dispatchQueue.add(
        'dispatch',
        {
          registrationId: data.registrationId,
          templateId: data.templateId,
          trigger: data.trigger,
        },
        { jobId },
      );
    } catch (err) {
      // Job already exists in queue (dedup) — not an error
      this.logger.debug(`Job ${jobId} already queued`);
    }
  }
}
