import { Global, Module } from '@nestjs/common';
import { OUTBOX_REPOSITORY_PORT } from '@domain/outbox_module/i-repository-outbox';
import { PrismaOutboxRepository } from './prisma-outbox.repository';

@Global()
@Module({
  providers: [{ provide: OUTBOX_REPOSITORY_PORT, useClass: PrismaOutboxRepository }],
  exports: [OUTBOX_REPOSITORY_PORT],
})
export class OutboxDbModule {}
