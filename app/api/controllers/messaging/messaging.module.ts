import { Module } from '@nestjs/common';
import { MessagingController } from './messaging_routes/messaging.controller';
import { MessageLogsService } from '@services/messaging/message-logs.service';
import { MessagingDbModule } from '@database/messaging/messaging-db.module';
import { GuardsModule } from '@api/config/guards/guards.module';

@Module({
  imports: [GuardsModule, MessagingDbModule],
  controllers: [MessagingController],
  providers: [MessageLogsService],
})
export class MessagingModule {}
