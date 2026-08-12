import { Global, Module } from '@nestjs/common';
import { FORM_FIELD_REPOSITORY_PORT } from '@domain/form_field_module/i-repository-form-field';
import { PrismaFormFieldRepository } from './prisma-form-field.repository';

@Global()
@Module({
  providers: [{ provide: FORM_FIELD_REPOSITORY_PORT, useClass: PrismaFormFieldRepository }],
  exports: [FORM_FIELD_REPOSITORY_PORT],
})
export class FormFieldDbModule {}
