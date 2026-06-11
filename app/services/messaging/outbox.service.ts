import { Injectable, Inject, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  OUTBOX_REPOSITORY_PORT,
  OutboxRepositoryPort,
  EnqueueMessageData,
} from '@domain/messaging/ports/outbox-repository.port';
import {
  QUEUE_MESSAGE_DISPATCH,
  QUEUE_SCHEDULED_AUTOMATIONS,
} from '@database/queue/bull-queues.module';

export interface EnqueueOptions {
  /** Atraso (ms) antes do job ficar disponível para o worker. Pacing anti-ban. */
  delayMs?: number;
}

@Injectable()
export class OutboxService implements OnApplicationBootstrap {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    @Inject(OUTBOX_REPOSITORY_PORT)
    private readonly outboxRepo: OutboxRepositoryPort,
    @InjectQueue(QUEUE_MESSAGE_DISPATCH) private readonly dispatchQueue: Queue,
    @InjectQueue(QUEUE_SCHEDULED_AUTOMATIONS) private readonly automationsQueue: Queue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Purge accumulated jobs from before removeOnComplete/removeOnFail were configured.
    // Message status lives in Postgres — safe to clean completed jobs aggressively.
    await this.dispatchQueue.clean(0, 10_000, 'completed');
    await this.dispatchQueue.clean(86_400_000, 10_000, 'failed');
    await this.automationsQueue.clean(0, 10_000, 'completed');
    await this.automationsQueue.clean(86_400_000, 10_000, 'failed');
    this.logger.log('Redis queue cleanup on bootstrap complete');
  }

  async enqueue(data: EnqueueMessageData, opts?: EnqueueOptions): Promise<void> {
    // Legacy (automation) callers don't pass dedupKey — compute the historical tuple
    const dedupKey = data.dedupKey ?? `${data.registrationId}:${data.templateId}:${data.trigger}`;
    const { id } = await this.outboxRepo.enqueue({ ...data, dedupKey });

    // jobId determinístico para dedup no BullMQ. BullMQ 5.x proíbe ":" em
    // custom jobIds (Job.addJob lança "Custom Id cannot contain :") — sanitiza.
    const jobId = dedupKey.replace(/:/g, '_');
    // delay agenda o job no futuro — usado para espaçar disparos WhatsApp (anti-ban).
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
      // add() com jobId duplicado NÃO lança (retorna o job existente) — chegar
      // aqui é falha real. Não relança para não abortar lotes no meio; a linha
      // do outbox fica pending e o erro fica visível no log.
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to enqueue dispatch job ${jobId}: ${msg}`);
    }
  }
}
