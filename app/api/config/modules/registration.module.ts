import { Module } from '@nestjs/common';
import { RegistrationController } from '@api/controllers/registration_module/registration.controller';
import { PublicRegistrationController } from '@api/controllers/registration_module/public-registration.controller';
import { PublicPostEventController } from '@api/controllers/registration_module/public-post-event.controller';
import { PublicNpsController } from '@api/controllers/registration_module/public-nps.controller';
import { RegistrationService } from '@application/registration_module/registration.service';
import { RegistrationDbModule } from '@infra/repositories/registration_module/registration-db.module';
import { AdaptersModule } from '@api/config/modules/adapters.module';
import { GuardsModule } from '@api/config/modules/guards.module';
import { EventModule } from '@api/config/modules/event.module';
import { FormModule } from '@api/config/modules/form.module';
import { FormFieldModule } from '@api/config/modules/form-field.module';
import { UserSubscriptionModule } from '@api/config/modules/user-subscription.module';

@Module({
  imports: [
    RegistrationDbModule,
    AdaptersModule,
    GuardsModule,
    EventModule,
    FormModule,
    FormFieldModule,
    UserSubscriptionModule,
  ],
  controllers: [
    RegistrationController,
    PublicRegistrationController,
    PublicPostEventController,
    PublicNpsController,
  ],
  providers: [RegistrationService],
  exports: [RegistrationService],
})
export class RegistrationModule {}
