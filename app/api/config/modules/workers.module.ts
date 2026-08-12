import { Module } from '@nestjs/common';
import { MessageDispatchWorker } from '@application/workers/message-dispatch.worker';
import { OutboxDbModule } from '@infra/repositories/outbox_module/outbox-db.module';
import { MessageLogsDbModule } from '@infra/repositories/message_log_module/message-logs-db.module';
import { EventsDbModule } from '@infra/repositories/event_module/events-db.module';
import { AdaptersModule } from '@api/adapters/modules/adapters.module';
import { BullQueuesModule } from '@infra/queue/bull-queues.module';
import { OutboxModule } from '@api/config/modules/outbox.module';
import { IcsGeneratorService } from '@application/shared/ics-generator.service';
import { RedisMaintenanceService } from '@application/workers/redis-maintenance.service';

@Module({
  imports: [
    BullQueuesModule,
    OutboxDbModule,
    MessageLogsDbModule,
    EventsDbModule,
    AdaptersModule,
    OutboxModule,
  ],
  providers: [MessageDispatchWorker, IcsGeneratorService, RedisMaintenanceService],
})
export class WorkersModule {}
