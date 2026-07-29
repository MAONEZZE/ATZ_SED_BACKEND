import { Module } from '@nestjs/common';
import { OUTBOX_REPOSITORY_PORT } from '@modules/messaging/ports/outbox-repository.port';
import { PrismaOutboxRepository } from './prisma-outbox.repository';
import { MessageLogsRepository } from './message-logs.repository';
import { MessageTemplatesRepository } from './message-templates.repository';
import { DeliveryStatusService } from './delivery-status.service';

@Module({
  providers: [
    { provide: OUTBOX_REPOSITORY_PORT, useClass: PrismaOutboxRepository },
    MessageLogsRepository,
    MessageTemplatesRepository,
    DeliveryStatusService,
  ],
  exports: [
    OUTBOX_REPOSITORY_PORT,
    MessageLogsRepository,
    MessageTemplatesRepository,
    DeliveryStatusService,
  ],
})
export class MessagingDbModule {}
