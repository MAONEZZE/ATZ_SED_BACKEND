import { Module } from '@nestjs/common';
import { MessageTemplatesController } from '@api/controllers/message_template_module/message-templates.controller';
import { TemplatesService } from '@application/message_template_module/templates.service';
import { MessageTemplatesDbModule } from '@infra/repositories/message_template_module/message-templates-db.module';
import { GuardsModule } from '@api/config/modules/guards.module';

@Module({
  imports: [MessageTemplatesDbModule, GuardsModule],
  controllers: [MessageTemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class MessageTemplatesModule {}
