import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

export const QUEUE_MESSAGE_DISPATCH = 'message-dispatch';
export const QUEUE_SCHEDULED_AUTOMATIONS = 'scheduled-automations';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL'),
          // Exigido pelo BullMQ p/ comandos blocking dos workers. Em Upstash evita
          // retries/reconexões que inflam a contagem de comandos (e o custo).
          maxRetriesPerRequest: null,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      {
        name: QUEUE_MESSAGE_DISPATCH,
        streams: { events: { maxLen: 500 } },
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 3600, count: 100 },
          removeOnFail: { age: 86400, count: 500 },
        },
      },
      {
        name: QUEUE_SCHEDULED_AUTOMATIONS,
        streams: { events: { maxLen: 200 } },
        defaultJobOptions: {
          // Recorrente roda a cada 1-2min e não tem histórico útil (estado no Postgres).
          // true = remove imediatamente ao completar; não acumula registros no Redis.
          removeOnComplete: true,
          removeOnFail: { age: 86400, count: 50 },
        },
      },
    ),
  ],
  exports: [BullModule],
})
export class BullQueuesModule {}
