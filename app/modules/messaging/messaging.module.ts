import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessageLogsService } from '@modules/messaging/message-logs.service';
import { MessagingDbModule } from '@modules/messaging/messaging-db.module';
import { GuardsModule } from '@shared/guards/guards.module';

@Module({
  imports: [GuardsModule, MessagingDbModule],
  controllers: [MessagingController],
  providers: [MessageLogsService],
})
export class MessagingModule {}
