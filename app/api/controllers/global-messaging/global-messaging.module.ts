import { Module } from '@nestjs/common';
import { GlobalMessagingController } from './global-messaging.controller';
import { GuardsModule } from '@api/config/guards/guards.module';
import { WorkersModule } from '@api/workers/workers.module';
import { EventsModule } from '@api/controllers/events/events.module';
import { ManualSendService } from '@services/messaging/manual-send.service';
import { TemplateRenderer } from '@services/automations/template-renderer.service';

@Module({
  imports: [GuardsModule, WorkersModule, EventsModule],
  controllers: [GlobalMessagingController],
  providers: [ManualSendService, TemplateRenderer],
})
export class GlobalMessagingModule {}
