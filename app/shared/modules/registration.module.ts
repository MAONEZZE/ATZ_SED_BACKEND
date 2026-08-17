import { Module } from '@nestjs/common';
import { RegistrationController } from '@api/controllers/registration_module/registration.controller';
import { RegistrationService } from '@application/registration_module/registration.service';
import { RegistrationDbModule } from '@infra/repositories/registration_module/registration-db.module';
import { FormResponseDbModule } from '@infra/repositories/form_response_module/form-response-db.module';
import { AdaptersModule } from '@shared/modules/adapters.module';
import { GuardsModule } from '@shared/modules/guards.module';
import { EventModule } from '@shared/modules/event.module';
import { FormModule } from '@shared/modules/form.module';
import { FormFieldModule } from '@shared/modules/form-field.module';

@Module({
  imports: [
    RegistrationDbModule,
    FormResponseDbModule,
    AdaptersModule,
    GuardsModule,
    EventModule,
    FormModule,
    FormFieldModule,
  ],
  controllers: [RegistrationController],
  providers: [RegistrationService],
  exports: [RegistrationService],
})
export class RegistrationModule {}
