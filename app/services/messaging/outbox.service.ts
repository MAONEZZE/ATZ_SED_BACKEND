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
    // Legacy (automation) callers don't pass dedupKey — compute the historical tuple
    const dedupKey = data.dedupKey ?? `${data.registrationId}:${data.templateId}:${data.trigger}`;
    const { id } = await this.outboxRepo.enqueue({ ...data, dedupKey });

    // jobId determinístico para dedup no BullMQ. BullMQ 5.x proíbe ":" em
    // custom jobIds (Job.addJob lança "Custom Id cannot contain :") — sanitiza.
    const jobId = dedupKey.replace(/:/g, '_');
    try {
      await this.dispatchQueue.add(
        'dispatch',
        {
          outboxId: id,
          registrationId: data.registrationId,
          templateId: data.templateId,
          trigger: data.trigger,
        },
        { jobId },
      );
    } catch (err) {
      // add() com jobId duplicado NÃO lança (retorna o job existente) — chegar
      // aqui é falha real. Não relança para não abortar lotes no meio; a linha
      // do outbox fica pending e o erro fica visível no log.
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to enqueue dispatch job ${jobId}: ${msg}`);
    }
  }
}
