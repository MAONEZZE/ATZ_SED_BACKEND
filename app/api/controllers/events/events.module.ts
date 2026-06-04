import { Module } from '@nestjs/common';
import { EventsController } from './events_routes/events.controller';
import { FormFieldsController } from './events_routes/form-fields.controller';
import { EventsService } from '@services/events/events.service';
import { EventLifecycleService } from '@services/events/event-lifecycle.service';
import { EventsDbModule } from '@database/events/events-db.module';
import { StorageModule } from '@database/storage/storage.module';
import { GuardsModule } from '@api/config/guards/guards.module';
import { WorkersModule } from '@api/workers/workers.module';

@Module({
  imports: [EventsDbModule, StorageModule, GuardsModule, WorkersModule],
  controllers: [EventsController, FormFieldsController],
  providers: [EventsService, EventLifecycleService],
  exports: [EventsService],
})
export class EventsModule {}
