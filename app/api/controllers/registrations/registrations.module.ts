import { Module } from '@nestjs/common';
import { RegistrationsController } from './registrations_routes/registrations.controller';
import { PostEventResponsesController } from './registrations_routes/post-event-responses.controller';
import { RegistrationsService } from '@services/registrations/registrations.service';
import { UserSubscriptionsService } from '@services/registrations/user-subscriptions.service';
import { RegistrationsDbModule } from '@database/registrations/registrations-db.module';
import { IntegrationsModule } from '@database/integrations/integrations.module';
import { GuardsModule } from '@api/config/guards/guards.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [RegistrationsDbModule, IntegrationsModule, GuardsModule, EventsModule],
  controllers: [RegistrationsController, PostEventResponsesController],
  providers: [RegistrationsService, UserSubscriptionsService],
  exports: [RegistrationsService, UserSubscriptionsService],
})
export class RegistrationsModule {}
