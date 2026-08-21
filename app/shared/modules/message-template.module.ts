import { Module } from '@nestjs/common';
import { MessageTemplateController } from '@api/controllers/message_template_module/message-template.controller';
import { MessageTemplateService } from '@application/message_template_module/message-template.service';
import { MessageTemplateDbModule } from '@infra/repositories/message_template_module/message-template-db.module';
import { AutomationDbModule } from '@infra/repositories/automation_module/automation-db.module';
import { GuardsModule } from '@shared/modules/guards.module';

@Module({
  imports: [MessageTemplateDbModule, AutomationDbModule, GuardsModule],
  controllers: [MessageTemplateController],
  providers: [MessageTemplateService],
  exports: [MessageTemplateService],
})
export class MessageTemplateModule {}
