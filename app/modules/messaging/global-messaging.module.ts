import { Module } from '@nestjs/common';
import { GlobalMessagingController } from './global-messaging.controller';
import { GuardsModule } from '@shared/guards/guards.module';
import { WorkersModule } from '@workers/workers.module';
import { EventsModule } from '@modules/events/events.module';
import { MessagingDbModule } from '@modules/messaging/messaging-db.module';
import { AutomationsDbModule } from '@modules/automations/automations-db.module';
import { StorageModule } from '@infra/storage/storage.module';
import { ManualSendService } from '@modules/messaging/manual-send.service';
import { TemplateRenderer } from '@modules/automations/template-renderer.service';
import { TemplatesService } from '@modules/messaging/templates.service';
import { MessageLogsService } from '@modules/messaging/message-logs.service';
import { AutomationsService } from '@modules/automations/automations.service';

@Module({
  imports: [
    GuardsModule,
    WorkersModule,
    EventsModule,
    MessagingDbModule,
    AutomationsDbModule,
    StorageModule,
  ],
  controllers: [GlobalMessagingController],
  providers: [
    ManualSendService,
    TemplateRenderer,
    TemplatesService,
    MessageLogsService,
    AutomationsService,
  ],
})
export class GlobalMessagingModule {}
