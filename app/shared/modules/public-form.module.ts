import { Module } from '@nestjs/common';
import { PublicFormController } from '@api/controllers/form_module/public-form.controller';
import { FormModule } from '@shared/modules/form.module';
import { FormFieldModule } from '@shared/modules/form-field.module';
import { RegistrationModule } from '@shared/modules/registration.module';
import { EventModule } from '@shared/modules/event.module';
import { PublicFormDocumentUploadController } from '@api/controllers/registration_module/form-document-upload.controller';

/**
 * As rotas públicas de formulário moram aqui, e não no FormModule, porque elas
 * dependem de Form + FormField + Registration ao mesmo tempo — pendurá-las no
 * FormModule criava ciclo de módulos (Form ↔ FormField e Form ↔ Registration).
 */
@Module({
  imports: [FormModule, FormFieldModule, RegistrationModule, EventModule],
  controllers: [PublicFormController, PublicFormDocumentUploadController],
})
export class PublicFormModule {}
