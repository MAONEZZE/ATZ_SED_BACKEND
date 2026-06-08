import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { GuardsModule } from '@api/config/guards/guards.module';
import { WorkersModule } from '@api/workers/workers.module';
import { EventsModule } from '@api/controllers/events/events.module';
import { ManualSendService } from '@services/messaging/manual-send.service';
import { TemplateRenderer } from '@services/automations/template-renderer.service';

@Module({
  imports: [GuardsModule, WorkersModule, EventsModule],
  controllers: [MessagingController],
  providers: [ManualSendService, TemplateRenderer],
})
export class MessagingModule {}
