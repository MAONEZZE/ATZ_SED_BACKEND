import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomInt } from 'crypto';
import { QUEUE_MESSAGE_DISPATCH } from '@database/queue/bull-queues.module';

/**
 * Espaçamento anti-ban entre mensagens de WhatsApp para contatos distintos.
 *
 * Mantém, por instância (número de WhatsApp), um "cursor" no Redis com o instante
 * do último slot reservado. Cada nova mensagem reserva um slot = max(agora, último)
 * + gap aleatório (WA_AUTOMATION_GAP_MIN_MS..MAX_MS) e devolve o atraso em ms para
 * ser usado como `delay` do job BullMQ.
 *
 * Importante: NÃO há sleep. O atraso é aplicado pelo delayed-set do BullMQ (o job
 * fica no Redis e o worker só o pega na hora), então o processo nunca fica preso.
 * O cálculo é atômico via script Lua para evitar corrida entre disparos concorrentes
 * na mesma instância.
 */
@Injectable()
export class WhatsappPacingService {
  private readonly gapMin: number;
  private readonly gapMax: number;

  // KEYS[1] = chave do cursor da instância; ARGV[1] = agora(ms); ARGV[2] = gap(ms).
  // Retorna o atraso (ms) a aplicar no job: slot reservado - agora.
  private static readonly RESERVE_SLOT_LUA = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local gap = tonumber(ARGV[2])
    local last = tonumber(redis.call('GET', key) or '0')
    local base = now
    if last > base then base = last end
    local slot = base + gap
    local ttl = (slot - now) + 60000
    redis.call('SET', key, slot, 'PX', ttl)
    return slot - now
  `;

  constructor(
    config: ConfigService,
    @InjectQueue(QUEUE_MESSAGE_DISPATCH) private readonly queue: Queue,
  ) {
    this.gapMin = config.get<number>('WA_AUTOMATION_GAP_MIN_MS') ?? 40_000;
    this.gapMax = config.get<number>('WA_AUTOMATION_GAP_MAX_MS') ?? 60_000;
  }

  /**
   * Reserva o próximo slot de envio para a instância e devolve o atraso (ms) a
   * aplicar no job. Em caso de falha no Redis, devolve 0 (não bloqueia o envio).
   */
  async nextDelayMs(instancia: string): Promise<number> {
    const gap = this.gapMax > this.gapMin ? randomInt(this.gapMin, this.gapMax + 1) : this.gapMin;
    const now = Date.now();
    // queue.client é tipado como IRedisClient (mínimo) pelo BullMQ; o cliente real
    // (ioredis) expõe eval. Cast estreito para acessá-lo sem importar ioredis.
    const client = (await this.queue.client) as unknown as {
      eval: (script: string, numkeys: number, ...args: (string | number)[]) => Promise<unknown>;
    };
    const delay = (await client.eval(
      WhatsappPacingService.RESERVE_SLOT_LUA,
      1,
      `wa:pacing:${instancia}`,
      String(now),
      String(gap),
    )) as number;
    return typeof delay === 'number' && delay > 0 ? delay : 0;
  }
}
