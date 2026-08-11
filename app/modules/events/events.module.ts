import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { FormFieldsController } from './form-fields.controller';
import { FormsController } from './forms.controller';
import { CollaboratorsController } from './collaborators.controller';
import { EventsService } from '@modules/events/events.service';
import { EventLifecycleService } from '@modules/events/event-lifecycle.service';
import { CollaboratorsService } from '@modules/events/collaborators.service';
import { FormFieldsService } from '@modules/events/form-fields.service';
import { FormsService } from '@modules/events/forms.service';
import { EventsDbModule } from '@modules/events/events-db.module';
import { StorageModule } from '@infra/storage/storage.module';
import { GuardsModule } from '@shared/guards/guards.module';
import { WorkersModule } from '@workers/workers.module';
import { AutomationsDbModule } from '@modules/automations/automations-db.module';
import { RegistrationsDbModule } from '@modules/registrations/registrations-db.module';
import { MessagingDbModule } from '@modules/messaging/messaging-db.module';

@Module({
  imports: [
    EventsDbModule,
    StorageModule,
    GuardsModule,
    WorkersModule,
    AutomationsDbModule,
    RegistrationsDbModule,
    MessagingDbModule,
  ],
  controllers: [EventsController, FormFieldsController, FormsController, CollaboratorsController],
  providers: [
    EventsService,
    EventLifecycleService,
    CollaboratorsService,
    FormFieldsService,
    FormsService,
  ],
  exports: [EventsService, FormFieldsService, FormsService],
})
export class EventsModule {}
