import { Global, Module } from '@nestjs/common';
import { FormFieldsRepository } from './form-fields.repository';

@Global()
@Module({
  providers: [FormFieldsRepository],
  exports: [FormFieldsRepository],
})
export class FormFieldsDbModule {}
