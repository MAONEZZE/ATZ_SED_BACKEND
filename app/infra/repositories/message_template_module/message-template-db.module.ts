import { Global, Module } from '@nestjs/common';
import { MESSAGE_TEMPLATE_REPOSITORY_PORT } from '@domain/message_template_module/i-repository-message-template';
import { PrismaMessageTemplateRepository } from './prisma-message-template.repository';

@Global()
@Module({
  providers: [
    { provide: MESSAGE_TEMPLATE_REPOSITORY_PORT, useClass: PrismaMessageTemplateRepository },
  ],
  exports: [MESSAGE_TEMPLATE_REPOSITORY_PORT],
})
export class MessageTemplateDbModule {}
