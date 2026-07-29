import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  OUTBOX_REPOSITORY_PORT,
  OutboxRepositoryPort,
  EnqueueMessageData,
} from '@modules/messaging/ports/outbox-repository.port';
import { QUEUE_MESSAGE_DISPATCH } from '@infra/queue/bull-queues.module';
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
  /**
   * Offset aditivo (ms) somado ao delay do cursor de pacing. Usado com
   * DISPATCH_GATE_ENABLED para preservar o gap de lote do envio manual por cima
   * do espaçamento por-mensagem do cursor compartilhado. Só tem efeito com
   * paceInstancia + gate ligado.
   */
  extraDelayMs?: number;
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  private readonly gateEnabled: boolean;

  constructor(
    @Inject(OUTBOX_REPOSITORY_PORT)
    private readonly outboxRepo: OutboxRepositoryPort,
    @InjectQueue(QUEUE_MESSAGE_DISPATCH) private readonly dispatchQueue: Queue,
    private readonly pacing: WhatsappPacingService,
    config: ConfigService,
  ) {
    this.gateEnabled = config.get<boolean>('DISPATCH_GATE_ENABLED') ?? false;
  }

  async enqueue(data: EnqueueMessageData, opts?: EnqueueOptions): Promise<void> {
    const dedupKey = data.dedupKey ?? `${data.registrationId}:${data.templateId}:${data.trigger}`;
    const { id, created } = await this.outboxRepo.enqueue({ ...data, dedupKey });

    const jobId = dedupKey.replace(/:/g, '_');
    let delay = opts?.delayMs ?? 0;
    // Pacing anti-ban: só para mensagens novas de canal whatsapp com paceInstancia.
    // Evita avançar o cursor em reprocessamentos (created=false).
    if (created && data.channel === 'whatsapp' && opts?.paceInstancia) {
      if (this.gateEnabled) {
        // Gate ligado: todo whatsapp reserva no cursor compartilhado; o offset de
        // lote (extraDelayMs) é somado por cima do espaçamento por-mensagem.
        delay = (await this.pacing.nextDelayMs(opts.paceInstancia)) + (opts.extraDelayMs ?? 0);
      } else if (delay === 0) {
        // Legado: só paceia quando o chamador não definiu delay próprio.
        delay = await this.pacing.nextDelayMs(opts.paceInstancia);
      }
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
