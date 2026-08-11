import { Module } from '@nestjs/common';
import { GlobalMessagingController } from './global-messaging.controller';
import { GuardsModule } from '@api/config/modules/guards.module';
import { WorkersModule } from '@application/workers/workers.module';
import { EventsModule } from '@domain/event_module/events.module';
import { EventsDbModule } from '@infra/repositories/event_module/events-db.module';
import { MessagingDbModule } from '@modules/messaging/messaging-db.module';
import { AutomationsDbModule } from '@modules/automations/automations-db.module';
import { RegistrationsDbModule } from '@modules/registrations/registrations-db.module';
import { WhatsappInstancesModule } from '@modules/whatsapp-instances/whatsapp-instances.module';
import { StorageModule } from '@api/adapters/modules/storage.module';
import { ManualSendService } from '@modules/messaging/manual-send.service';
import { MessageAttachmentsService } from '@modules/messaging/message-attachments.service';
import { TemplateRenderer } from '@modules/automations/template-renderer.service';
import { TemplatesService } from '@modules/messaging/templates.service';
import { MessageLogsService } from '@modules/messaging/message-logs.service';
import { AutomationsModule } from '@modules/automations/automations.module';

@Module({
  imports: [
    GuardsModule,
    WorkersModule,
    EventsModule,
    EventsDbModule,
    MessagingDbModule,
    AutomationsDbModule,
    RegistrationsDbModule,
    WhatsappInstancesModule,
    StorageModule,
    AutomationsModule,
  ],
  controllers: [GlobalMessagingController],
  providers: [
    ManualSendService,
    MessageAttachmentsService,
    TemplateRenderer,
    TemplatesService,
    MessageLogsService,
  ],
})
export class GlobalMessagingModule {}
