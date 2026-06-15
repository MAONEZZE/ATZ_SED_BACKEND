import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  OUTBOX_REPOSITORY_PORT,
  OutboxRepositoryPort,
  EnqueueMessageData,
} from '@domain/messaging/ports/outbox-repository.port';
import { QUEUE_MESSAGE_DISPATCH } from '@database/queue/bull-queues.module';

export interface EnqueueOptions {
  delayMs?: number;
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    @Inject(OUTBOX_REPOSITORY_PORT)
    private readonly outboxRepo: OutboxRepositoryPort,
    @InjectQueue(QUEUE_MESSAGE_DISPATCH) private readonly dispatchQueue: Queue,
  ) {}

  async enqueue(data: EnqueueMessageData, opts?: EnqueueOptions): Promise<void> {
    const dedupKey = data.dedupKey ?? `${data.registrationId}:${data.templateId}:${data.trigger}`;
    const { id } = await this.outboxRepo.enqueue({ ...data, dedupKey });

    const jobId = dedupKey.replace(/:/g, '_');
    const delay = opts?.delayMs ?? 0;
    try {
      await this.dispatchQueue.add(
        'dispatch',
        {
          outboxId: id,
          registrationId: data.registrationId,
          templateId: data.templateId,
          trigger: data.trigger,
        },
        { jobId, delay },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to enqueue dispatch job ${jobId}: ${msg}`);
    }
  }
}
