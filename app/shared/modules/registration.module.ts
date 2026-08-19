import { Module } from '@nestjs/common';
import { RegistrationController } from '@api/controllers/registration_module/registration.controller';
import { PublicCheckinController } from '@api/controllers/registration_module/public-checkin.controller';
import { RegistrationService } from '@application/registration_module/registration.service';
import { AnswerImageService } from '@application/registration_module/answer-images.service';
import { StorageModule } from '@shared/modules/storage.module';
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
    StorageModule,
    GuardsModule,
    EventModule,
    FormModule,
    FormFieldModule,
  ],
  controllers: [RegistrationController, PublicCheckinController],
  providers: [RegistrationService, AnswerImageService],
  exports: [RegistrationService],
})
export class RegistrationModule {}
