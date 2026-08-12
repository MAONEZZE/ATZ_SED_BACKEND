import { Module } from '@nestjs/common';
import { FormsController } from '@api/controllers/form_module/forms.controller';
import { FormsService } from '@application/form_module/forms.service';
import { FormsDbModule } from '@infra/repositories/form_module/forms-db.module';
import { GuardsModule } from '@api/config/modules/guards.module';

@Module({
  imports: [FormsDbModule, GuardsModule],
  controllers: [FormsController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}
