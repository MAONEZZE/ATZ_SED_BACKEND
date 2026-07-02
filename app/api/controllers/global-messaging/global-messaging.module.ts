import { Module } from '@nestjs/common';
import { GlobalMessagingController } from './global-messaging_routes/global-messaging.controller';
import { GuardsModule } from '@api/config/guards/guards.module';
import { WorkersModule } from '@api/workers/workers.module';
import { EventsModule } from '@api/controllers/events/events.module';
import { MessagingDbModule } from '@database/messaging/messaging-db.module';
import { AutomationsDbModule } from '@database/automations/automations-db.module';
import { ManualSendService } from '@services/messaging/manual-send.service';
import { TemplateRenderer } from '@services/automations/template-renderer.service';
import { TemplatesService } from '@services/messaging/templates.service';
import { MessageLogsService } from '@services/messaging/message-logs.service';
import { AutomationsService } from '@services/automations/automations.service';

@Module({
  imports: [GuardsModule, WorkersModule, EventsModule, MessagingDbModule, AutomationsDbModule],
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
