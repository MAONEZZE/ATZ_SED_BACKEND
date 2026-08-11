import { Module } from '@nestjs/common';
import { RegistrationsController } from '@api/controllers/registration_module/registrations.controller';
import { PublicRegistrationsController } from '@api/controllers/registration_module/public-registrations.controller';
import { PublicPostEventController } from '@api/controllers/registration_module/public-post-event.controller';
import { PublicNpsController } from '@api/controllers/registration_module/public-nps.controller';
import { RegistrationsService } from '@application/registration_module/registrations.service';
import { RegistrationsDbModule } from '@infra/repositories/registration_module/registrations-db.module';
import { AdaptersModule } from '@api/adapters/modules/adapters.module';
import { GuardsModule } from '@api/config/modules/guards.module';
import { EventsModule } from '@domain/event_module/events.module';
import { FormsModule } from '@domain/form_module/forms.module';
import { FormFieldsModule } from '@domain/form_field_module/form-fields.module';
import { UserSubscriptionsModule } from '@domain/user_subscription_module/user-subscriptions.module';

@Module({
  imports: [
    RegistrationsDbModule,
    AdaptersModule,
    GuardsModule,
    EventsModule,
    FormsModule,
    FormFieldsModule,
    UserSubscriptionsModule,
  ],
  controllers: [
    RegistrationsController,
    PublicRegistrationsController,
    PublicPostEventController,
    PublicNpsController,
  ],
  providers: [RegistrationsService],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
