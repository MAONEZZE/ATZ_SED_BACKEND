import { Module } from '@nestjs/common';
import { OUTBOX_REPOSITORY_PORT } from '@domain/messaging/ports/outbox-repository.port';
import { PrismaOutboxRepository } from './prisma-outbox.repository';
import { MessageLogsRepository } from './message-logs.repository';
import { MessageTemplatesRepository } from './message-templates.repository';

@Module({
  providers: [
    { provide: OUTBOX_REPOSITORY_PORT, useClass: PrismaOutboxRepository },
    MessageLogsRepository,
    MessageTemplatesRepository,
  ],
  exports: [OUTBOX_REPOSITORY_PORT, MessageLogsRepository, MessageTemplatesRepository],
})
export class MessagingDbModule {}
