import { Module } from '@nestjs/common';
import { RegistrationsController } from './registrations.controller';
import { PostEventResponsesController } from './post-event-responses.controller';
import { UserSubscriptionsController } from './user-subscriptions.controller';
import { RegistrationsService } from '@modules/registrations/registrations.service';
import { UserSubscriptionsService } from '@modules/registrations/user-subscriptions.service';
import { PostEventResponsesService } from '@modules/registrations/post-event-responses.service';
import { RegistrationsDbModule } from '@modules/registrations/registrations-db.module';
import { IntegrationsModule } from '@infra/integrations/integrations.module';
import { GuardsModule } from '@shared/guards/guards.module';
import { EventsModule } from '../events/events.module';
import { UsersDbModule } from '@modules/users/users-db.module';

@Module({
  imports: [RegistrationsDbModule, IntegrationsModule, GuardsModule, EventsModule, UsersDbModule],
  controllers: [RegistrationsController, PostEventResponsesController, UserSubscriptionsController],
  providers: [RegistrationsService, UserSubscriptionsService, PostEventResponsesService],
  exports: [RegistrationsService, UserSubscriptionsService],
})
export class RegistrationsModule {}
