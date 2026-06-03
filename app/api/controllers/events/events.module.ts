import { Module } from '@nestjs/common';
import { EventsController } from './events_routes/events.controller';
import { EventsService } from '@services/events/events.service';
import { EventsDbModule } from '@database/events/events-db.module';
import { StorageModule } from '@database/storage/storage.module';
import { GuardsModule } from '@api/config/guards/guards.module';

@Module({
  imports: [EventsDbModule, StorageModule, GuardsModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
