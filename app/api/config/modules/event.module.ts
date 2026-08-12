import { Module } from '@nestjs/common';
import { EventController } from '@api/controllers/event_module/event.controller';
import { PublicEventController } from '@api/controllers/event_module/public-event.controller';
import { EventService } from '@application/event_module/event.service';
import { EventLifecycleService } from '@application/event_module/event-lifecycle.service';
import { PublicEventService } from '@application/event_module/public-event.service';
import { EventDbModule } from '@infra/repositories/event_module/event-db.module';
import { StorageModule } from '@api/config/modules/storage.module';
import { GuardsModule } from '@api/config/modules/guards.module';
import { OutboxModule } from '@api/config/modules/outbox.module';
import { AutomationDbModule } from '@infra/repositories/automation_module/automation-db.module';
import { RegistrationDbModule } from '@infra/repositories/registration_module/registration-db.module';
import { MessageTemplateDbModule } from '@infra/repositories/message_template_module/message-template-db.module';
import { ProfileDbModule } from '@infra/repositories/profile_module/profile-db.module';

@Module({
  imports: [
    EventDbModule,
    StorageModule,
    GuardsModule,
    OutboxModule,
    AutomationDbModule,
    RegistrationDbModule,
    MessageTemplateDbModule,
    ProfileDbModule,
  ],
  controllers: [EventController, PublicEventController],
  providers: [EventService, EventLifecycleService, PublicEventService],
  exports: [EventService, PublicEventService],
})
export class EventModule {}
