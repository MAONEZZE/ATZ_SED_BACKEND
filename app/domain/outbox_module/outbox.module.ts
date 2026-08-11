import { Module } from '@nestjs/common';
import { OutboxMessagesController } from '@api/controllers/outbox_module/outbox-messages.controller';
import { OutboxService } from '@application/outbox_module/outbox.service';
import { ManualSendService } from '@application/outbox_module/manual-send.service';
import { MessageAttachmentsService } from '@application/outbox_module/message-attachments.service';
import { WhatsappPacingService } from '@application/outbox_module/whatsapp-pacing.service';
import { DeliveryStatusService } from '@application/outbox_module/delivery-status.service';
import { TemplateRenderer } from '@application/shared/template-renderer.service';
import { OutboxDbModule } from '@infra/repositories/outbox_module/outbox-db.module';
import { MessageTemplatesDbModule } from '@infra/repositories/message_template_module/message-templates-db.module';
import { MessageLogsDbModule } from '@infra/repositories/message_log_module/message-logs-db.module';
import { StorageModule } from '@api/adapters/modules/storage.module';
import { GuardsModule } from '@api/config/modules/guards.module';
import { BullQueuesModule } from '@infra/queue/bull-queues.module';

@Module({
  imports: [
    OutboxDbModule,
    MessageTemplatesDbModule,
    MessageLogsDbModule,
    StorageModule,
    GuardsModule,
    BullQueuesModule,
  ],
  controllers: [OutboxMessagesController],
  providers: [
    OutboxService,
    ManualSendService,
    MessageAttachmentsService,
    WhatsappPacingService,
    DeliveryStatusService,
    TemplateRenderer,
  ],
  exports: [OutboxService, WhatsappPacingService, DeliveryStatusService],
})
export class OutboxModule {}
