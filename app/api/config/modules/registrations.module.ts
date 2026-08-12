import { Module } from '@nestjs/common';
import { RegistrationsController } from '@api/controllers/registration_module/registrations.controller';
import { PublicRegistrationsController } from '@api/controllers/registration_module/public-registrations.controller';
import { PublicPostEventController } from '@api/controllers/registration_module/public-post-event.controller';
import { PublicNpsController } from '@api/controllers/registration_module/public-nps.controller';
import { RegistrationsService } from '@application/registration_module/registrations.service';
import { RegistrationsDbModule } from '@infra/repositories/registration_module/registrations-db.module';
import { AdaptersModule } from '@api/adapters/modules/adapters.module';
import { GuardsModule } from '@api/config/modules/guards.module';
import { EventsModule } from '@api/config/modules/events.module';
import { FormsModule } from '@api/config/modules/forms.module';
import { FormFieldsModule } from '@api/config/modules/form-fields.module';
import { UserSubscriptionsModule } from '@api/config/modules/user-subscriptions.module';

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
