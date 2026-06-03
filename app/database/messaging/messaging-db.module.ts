import { Module } from '@nestjs/common';
import { OUTBOX_REPOSITORY_PORT } from '@domain/messaging/ports/outbox-repository.port';
import { PrismaOutboxRepository } from './prisma-outbox.repository';

@Module({
  providers: [
    { provide: OUTBOX_REPOSITORY_PORT, useClass: PrismaOutboxRepository },
  ],
  exports: [OUTBOX_REPOSITORY_PORT],
})
export class MessagingDbModule {}
