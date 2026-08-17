import { Module } from '@nestjs/common';
import { PublicFormController } from '@api/controllers/form_module/public-form.controller';
import { FormModule } from '@shared/modules/form.module';
import { FormFieldModule } from '@shared/modules/form-field.module';
import { RegistrationModule } from '@shared/modules/registration.module';

/**
 * As rotas públicas de formulário moram aqui, e não no FormModule, porque elas
 * dependem de Form + FormField + Registration ao mesmo tempo — pendurá-las no
 * FormModule criava ciclo de módulos (Form ↔ FormField e Form ↔ Registration).
 */
@Module({
  imports: [FormModule, FormFieldModule, RegistrationModule],
  controllers: [PublicFormController],
})
export class PublicFormModule {}
