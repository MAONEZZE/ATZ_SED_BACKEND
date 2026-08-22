import { Module } from '@nestjs/common';
import { FormResponseController } from '@api/controllers/form_response_module/form-response.controller';
import { FormResponseService } from '@application/form_response_module/form-response.service';
import { FormResponseDbModule } from '@infra/repositories/form_response_module/form-response-db.module';
import { FormModule } from '@shared/modules/form.module';
import { FormFieldModule } from '@shared/modules/form-field.module';
import { GuardsModule } from '@shared/modules/guards.module';

@Module({
  imports: [FormResponseDbModule, FormModule, FormFieldModule, GuardsModule],
  controllers: [FormResponseController],
  providers: [FormResponseService],
  exports: [FormResponseService],
})
export class FormResponseModule {}
