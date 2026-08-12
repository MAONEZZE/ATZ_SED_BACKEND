import { Module } from '@nestjs/common';
import { FormFieldController } from '@api/controllers/form_field_module/form-field.controller';
import { FormFieldService } from '@application/form_field_module/form-field.service';
import { FormFieldDbModule } from '@infra/repositories/form_field_module/form-field-db.module';
import { EventModule } from '@shared/modules/event.module';
import { FormModule } from '@shared/modules/form.module';
import { GuardsModule } from '@shared/modules/guards.module';

@Module({
  imports: [FormFieldDbModule, EventModule, FormModule, GuardsModule],
  controllers: [FormFieldController],
  providers: [FormFieldService],
  exports: [FormFieldService],
})
export class FormFieldModule {}
