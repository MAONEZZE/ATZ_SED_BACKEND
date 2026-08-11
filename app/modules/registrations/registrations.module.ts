import { Module } from '@nestjs/common';
import { RegistrationsController } from './registrations.controller';
import { PostEventResponsesController } from './post-event-responses.controller';
import { UserSubscriptionsController } from './user-subscriptions.controller';
import { PublicRegistrationsController } from './public-registrations.controller';
import { PublicPostEventController } from './public-post-event.controller';
import { PublicNpsController } from './public-nps.controller';
import { RegistrationsService } from '@modules/registrations/registrations.service';
import { UserSubscriptionsService } from '@modules/registrations/user-subscriptions.service';
import { PostEventResponsesService } from '@modules/registrations/post-event-responses.service';
import { RegistrationsDbModule } from '@modules/registrations/registrations-db.module';
import { AdaptersModule } from '@api/adapters/modules/adapters.module';
import { GuardsModule } from '@api/config/modules/guards.module';
import { EventsModule } from '@domain/event_module/events.module';
import { FormsModule } from '@domain/form_module/forms.module';
import { FormFieldsModule } from '@domain/form_field_module/form-fields.module';

@Module({
  imports: [
    RegistrationsDbModule,
    AdaptersModule,
    GuardsModule,
    EventsModule,
    FormsModule,
    FormFieldsModule,
  ],
  controllers: [
    RegistrationsController,
    PostEventResponsesController,
    UserSubscriptionsController,
    PublicRegistrationsController,
    PublicPostEventController,
    PublicNpsController,
  ],
  providers: [RegistrationsService, UserSubscriptionsService, PostEventResponsesService],
  exports: [RegistrationsService, UserSubscriptionsService],
})
export class RegistrationsModule {}
