import { Module } from '@nestjs/common';
import { MessageDispatchWorker } from './message-dispatch.worker';
import { MessagingDbModule } from '@database/messaging/messaging-db.module';
import { IntegrationsModule } from '@database/integrations/integrations.module';
import { BullQueuesModule } from '@database/queue/bull-queues.module';
import { OutboxService } from '@services/messaging/outbox.service';
import { IcsGeneratorService } from '@services/automations/ics-generator.service';

@Module({
  imports: [BullQueuesModule, MessagingDbModule, IntegrationsModule],
  providers: [MessageDispatchWorker, OutboxService, IcsGeneratorService],
  exports: [OutboxService],
})
export class WorkersModule {}
