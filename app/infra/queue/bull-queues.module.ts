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
          removeOnComplete: true,
          removeOnFail: { age: 86400, count: 50 },
        },
      },
    ),
  ],
  exports: [BullModule],
})
export class BullQueuesModule {}
