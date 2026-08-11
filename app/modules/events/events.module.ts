import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { FormFieldsController } from './form-fields.controller';
import { FormsController } from './forms.controller';
import { CollaboratorsController } from './collaborators.controller';
import { PublicEventsController } from './public-events.controller';
import { EventsService } from '@modules/events/events.service';
import { EventLifecycleService } from '@modules/events/event-lifecycle.service';
import { CollaboratorsService } from '@modules/events/collaborators.service';
import { FormFieldsService } from '@modules/events/form-fields.service';
import { FormsService } from '@modules/events/forms.service';
import { PublicEventsService } from '@modules/events/public-events.service';
import { EventsDbModule } from '@modules/events/events-db.module';
import { StorageModule } from '@api/adapters/modules/storage.module';
import { GuardsModule } from '@api/config/modules/guards.module';
import { WorkersModule } from '@application/workers/workers.module';
import { AutomationsDbModule } from '@modules/automations/automations-db.module';
import { RegistrationsDbModule } from '@modules/registrations/registrations-db.module';
import { MessagingDbModule } from '@modules/messaging/messaging-db.module';
import { ProfileDbModule } from '@modules/profile/profile-db.module';

@Module({
  imports: [
    EventsDbModule,
    StorageModule,
    GuardsModule,
    WorkersModule,
    AutomationsDbModule,
    RegistrationsDbModule,
    MessagingDbModule,
    ProfileDbModule,
  ],
  controllers: [
    EventsController,
    FormFieldsController,
    FormsController,
    CollaboratorsController,
    PublicEventsController,
  ],
  providers: [
    EventsService,
    EventLifecycleService,
    CollaboratorsService,
    FormFieldsService,
    FormsService,
    PublicEventsService,
  ],
  exports: [EventsService, FormFieldsService, FormsService, PublicEventsService],
})
export class EventsModule {}
