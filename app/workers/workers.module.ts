import { Module } from '@nestjs/common';
import { MessageDispatchWorker } from './message-dispatch.worker';
import { MessagingDbModule } from '@modules/messaging/messaging-db.module';
import { IntegrationsModule } from '@infra/integrations/integrations.module';
import { BullQueuesModule } from '@infra/queue/bull-queues.module';
import { OutboxService } from '@modules/messaging/outbox.service';
import { WhatsappPacingService } from '@modules/messaging/whatsapp-pacing.service';
import { IcsGeneratorService } from '@modules/automations/ics-generator.service';
import { RedisMaintenanceService } from './redis-maintenance.service';

@Module({
  imports: [BullQueuesModule, MessagingDbModule, IntegrationsModule],
  providers: [
    MessageDispatchWorker,
    OutboxService,
    WhatsappPacingService,
    IcsGeneratorService,
    RedisMaintenanceService,
  ],
  exports: [OutboxService],
})
export class WorkersModule {}
