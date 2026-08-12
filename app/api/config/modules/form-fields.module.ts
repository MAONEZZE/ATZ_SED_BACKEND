import { Module } from '@nestjs/common';
import { FormFieldsController } from '@api/controllers/form_field_module/form-fields.controller';
import { FormFieldsService } from '@application/form_field_module/form-fields.service';
import { FormFieldsDbModule } from '@infra/repositories/form_field_module/form-fields-db.module';
import { EventsModule } from '@api/config/modules/events.module';
import { FormsModule } from '@api/config/modules/forms.module';
import { GuardsModule } from '@api/config/modules/guards.module';

@Module({
  imports: [FormFieldsDbModule, EventsModule, FormsModule, GuardsModule],
  controllers: [FormFieldsController],
  providers: [FormFieldsService],
  exports: [FormFieldsService],
})
export class FormFieldsModule {}
