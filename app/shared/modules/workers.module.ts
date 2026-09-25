import { Module } from '@nestjs/common';
import { MessageDispatchWorker } from '@application/workers/message-dispatch.worker';
import { OutboxDbModule } from '@infra/repositories/outbox_module/outbox-db.module';
import { MessageLogDbModule } from '@infra/repositories/message_log_module/message-log-db.module';
import { EventDbModule } from '@infra/repositories/event_module/event-db.module';
import { AdaptersModule } from '@shared/modules/adapters.module';
import { BullQueuesModule } from '@infra/queue/bull-queues.module';
import { OutboxModule } from '@shared/modules/outbox.module';
import { IcsGeneratorService } from '@application/shared/ics-generator.service';
import { RedisMaintenanceService } from '@application/workers/redis-maintenance.service';
import { OutboxMaintenanceService } from '@application/workers/outbox-maintenance.service';
import { FormUploadMaintenanceService } from '@application/workers/form-upload-maintenance.service';
import { RegistrationModule } from '@shared/modules/registration.module';

@Module({
  imports: [
    BullQueuesModule,
    OutboxDbModule,
    MessageLogDbModule,
    EventDbModule,
    AdaptersModule,
    OutboxModule,
    RegistrationModule,
  ],
  providers: [
    MessageDispatchWorker,
    IcsGeneratorService,
    RedisMaintenanceService,
    OutboxMaintenanceService,
    FormUploadMaintenanceService,
  ],
})
export class WorkersModule {}
