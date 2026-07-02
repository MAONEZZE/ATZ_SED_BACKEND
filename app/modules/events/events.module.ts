import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { FormFieldsController } from './form-fields.controller';
import { CollaboratorsController } from './collaborators.controller';
import { EventsService } from '@modules/events/events.service';
import { EventLifecycleService } from '@modules/events/event-lifecycle.service';
import { CollaboratorsService } from '@modules/events/collaborators.service';
import { FormFieldsService } from '@modules/events/form-fields.service';
import { EventsDbModule } from '@modules/events/events-db.module';
import { StorageModule } from '@infra/storage/storage.module';
import { GuardsModule } from '@shared/guards/guards.module';
import { WorkersModule } from '@workers/workers.module';

@Module({
  imports: [EventsDbModule, StorageModule, GuardsModule, WorkersModule],
  controllers: [EventsController, FormFieldsController, CollaboratorsController],
  providers: [EventsService, EventLifecycleService, CollaboratorsService, FormFieldsService],
  exports: [EventsService, FormFieldsService],
})
export class EventsModule {}
