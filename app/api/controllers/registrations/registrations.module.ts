import { Module } from '@nestjs/common';
import { RegistrationsController } from './registrations_routes/registrations.controller';
import { PostEventResponsesController } from './registrations_routes/post-event-responses.controller';
import { RegistrationsService } from '@services/registrations/registrations.service';
import { RegistrationsDbModule } from '@database/registrations/registrations-db.module';
import { GuardsModule } from '@api/config/guards/guards.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [RegistrationsDbModule, GuardsModule, EventsModule],
  controllers: [RegistrationsController, PostEventResponsesController],
  providers: [RegistrationsService],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
