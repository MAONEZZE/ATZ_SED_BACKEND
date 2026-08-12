import { Global, Module } from '@nestjs/common';
import { MESSAGE_LOG_REPOSITORY_PORT } from '@domain/message_log_module/i-repository-message-log';
import { PrismaMessageLogRepository } from './prisma-message-log.repository';

@Global()
@Module({
  providers: [{ provide: MESSAGE_LOG_REPOSITORY_PORT, useClass: PrismaMessageLogRepository }],
  exports: [MESSAGE_LOG_REPOSITORY_PORT],
})
export class MessageLogDbModule {}
