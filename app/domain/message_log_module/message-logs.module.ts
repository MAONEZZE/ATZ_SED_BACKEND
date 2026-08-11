import { Module } from '@nestjs/common';
import { MessageLogsController } from '@api/controllers/message_log_module/message-logs.controller';
import { GlobalMessageLogsController } from '@api/controllers/message_log_module/global-message-logs.controller';
import { MessageLogsService } from '@application/message_log_module/message-logs.service';
import { MessageLogsDbModule } from '@infra/repositories/message_log_module/message-logs-db.module';
import { GuardsModule } from '@api/config/modules/guards.module';

@Module({
  imports: [MessageLogsDbModule, GuardsModule],
  controllers: [MessageLogsController, GlobalMessageLogsController],
  providers: [MessageLogsService],
  exports: [MessageLogsService],
})
export class MessageLogsModule {}
