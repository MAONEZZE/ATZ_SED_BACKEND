import { Global, Module } from '@nestjs/common';
import { MessageLogsRepository } from './message-logs.repository';

@Global()
@Module({
  providers: [MessageLogsRepository],
  exports: [MessageLogsRepository],
})
export class MessageLogsDbModule {}
