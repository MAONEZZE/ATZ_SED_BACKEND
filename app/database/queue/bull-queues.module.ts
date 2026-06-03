import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

export const QUEUE_MESSAGE_DISPATCH = 'message-dispatch';
export const QUEUE_SCHEDULED_AUTOMATIONS = 'scheduled-automations';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>('REDIS_URL') },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      {
        name: QUEUE_MESSAGE_DISPATCH,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      },
      {
        name: QUEUE_SCHEDULED_AUTOMATIONS,
        defaultJobOptions: { removeOnComplete: 10, removeOnFail: 50 },
      },
    ),
  ],
  exports: [BullModule],
})
export class BullQueuesModule {}
