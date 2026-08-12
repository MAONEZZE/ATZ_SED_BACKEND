import { Module } from '@nestjs/common';
import { MessageLogController } from '@api/controllers/message_log_module/message-log.controller';
import { GlobalMessageLogController } from '@api/controllers/message_log_module/global-message-log.controller';
import { MessageLogService } from '@application/message_log_module/message-log.service';
import { MessageLogDbModule } from '@infra/repositories/message_log_module/message-log-db.module';
import { GuardsModule } from '@api/config/modules/guards.module';

@Module({
  imports: [MessageLogDbModule, GuardsModule],
  controllers: [MessageLogController, GlobalMessageLogController],
  providers: [MessageLogService],
  exports: [MessageLogService],
})
export class MessageLogModule {}
