import { Module } from '@nestjs/common';
import { MessageDispatchWorker } from '@application/workers/message-dispatch.worker';
import { OutboxDbModule } from '@infra/repositories/outbox_module/outbox-db.module';
import { MessageLogDbModule } from '@infra/repositories/message_log_module/message-log-db.module';
import { EventDbModule } from '@infra/repositories/event_module/event-db.module';
import { AdaptersModule } from '@api/config/modules/adapters.module';
import { BullQueuesModule } from '@infra/queue/bull-queues.module';
import { OutboxModule } from '@api/config/modules/outbox.module';
import { IcsGeneratorService } from '@application/shared/ics-generator.service';
import { RedisMaintenanceService } from '@application/workers/redis-maintenance.service';

@Module({
  imports: [
    BullQueuesModule,
    OutboxDbModule,
    MessageLogDbModule,
    EventDbModule,
    AdaptersModule,
    OutboxModule,
  ],
  providers: [MessageDispatchWorker, IcsGeneratorService, RedisMaintenanceService],
})
export class WorkersModule {}
