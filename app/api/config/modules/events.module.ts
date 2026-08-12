import { Module } from '@nestjs/common';
import { EventsController } from '@api/controllers/event_module/events.controller';
import { PublicEventsController } from '@api/controllers/event_module/public-events.controller';
import { EventsService } from '@application/event_module/events.service';
import { EventLifecycleService } from '@application/event_module/event-lifecycle.service';
import { PublicEventsService } from '@application/event_module/public-events.service';
import { EventsDbModule } from '@infra/repositories/event_module/events-db.module';
import { StorageModule } from '@api/config/modules/storage.module';
import { GuardsModule } from '@api/config/modules/guards.module';
import { OutboxModule } from '@api/config/modules/outbox.module';
import { AutomationsDbModule } from '@infra/repositories/automation_module/automations-db.module';
import { RegistrationsDbModule } from '@infra/repositories/registration_module/registrations-db.module';
import { MessageTemplatesDbModule } from '@infra/repositories/message_template_module/message-templates-db.module';
import { ProfileDbModule } from '@infra/repositories/profile_module/profile-db.module';

@Module({
  imports: [
    EventsDbModule,
    StorageModule,
    GuardsModule,
    OutboxModule,
    AutomationsDbModule,
    RegistrationsDbModule,
    MessageTemplatesDbModule,
    ProfileDbModule,
  ],
  controllers: [EventsController, PublicEventsController],
  providers: [EventsService, EventLifecycleService, PublicEventsService],
  exports: [EventsService, PublicEventsService],
})
export class EventsModule {}
