import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  OUTBOX_REPOSITORY_PORT,
  OutboxRepositoryPort,
  EnqueueMessageData,
} from '@domain/messaging/ports/outbox-repository.port';
import { QUEUE_MESSAGE_DISPATCH } from '@database/queue/bull-queues.module';
import { WhatsappPacingService } from './whatsapp-pacing.service';

export interface EnqueueOptions {
  /** Atraso explícito do job em ms (usado, p.ex., pelo envio manual em lote). */
  delayMs?: number;
  /**
   * Instância de WhatsApp para aplicar o espaçamento anti-ban entre contatos.
   * Só tem efeito em mensagens novas e de canal whatsapp. Ignorado se delayMs for
   * informado (o chamador já controla o próprio espaçamento).
   */
  paceInstancia?: string;
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    @Inject(OUTBOX_REPOSITORY_PORT)
    private readonly outboxRepo: OutboxRepositoryPort,
    @InjectQueue(QUEUE_MESSAGE_DISPATCH) private readonly dispatchQueue: Queue,
    private readonly pacing: WhatsappPacingService,
  ) {}

  async enqueue(data: EnqueueMessageData, opts?: EnqueueOptions): Promise<void> {
    const dedupKey = data.dedupKey ?? `${data.registrationId}:${data.templateId}:${data.trigger}`;
    const { id, created } = await this.outboxRepo.enqueue({ ...data, dedupKey });

    const jobId = dedupKey.replace(/:/g, '_');
    let delay = opts?.delayMs ?? 0;
    // Pacing anti-ban: só para mensagens novas, canal whatsapp e quando o chamador
    // não definiu um delay próprio. Evita avançar o cursor em reprocessamentos.
    if (created && delay === 0 && opts?.paceInstancia && data.channel === 'whatsapp') {
      delay = await this.pacing.nextDelayMs(opts.paceInstancia);
    }
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
