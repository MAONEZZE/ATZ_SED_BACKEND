import { Global, Module } from '@nestjs/common';
import { MessageTemplatesRepository } from './message-templates.repository';

@Global()
@Module({
  providers: [MessageTemplatesRepository],
  exports: [MessageTemplatesRepository],
})
export class MessageTemplatesDbModule {}
