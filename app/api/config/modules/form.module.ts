import { Module } from '@nestjs/common';
import { FormController } from '@api/controllers/form_module/form.controller';
import { FormService } from '@application/form_module/form.service';
import { FormDbModule } from '@infra/repositories/form_module/form-db.module';
import { GuardsModule } from '@api/config/modules/guards.module';

@Module({
  imports: [FormDbModule, GuardsModule],
  controllers: [FormController],
  providers: [FormService],
  exports: [FormService],
})
export class FormModule {}
