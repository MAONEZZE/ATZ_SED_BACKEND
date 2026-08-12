import { Global, Module } from '@nestjs/common';
import { EVENT_REPOSITORY_PORT } from '@domain/event_module/i-repository-event';
import { PrismaEventRepository } from './prisma-event.repository';

@Global()
@Module({
  providers: [{ provide: EVENT_REPOSITORY_PORT, useClass: PrismaEventRepository }],
  exports: [EVENT_REPOSITORY_PORT],
})
export class EventDbModule {}
