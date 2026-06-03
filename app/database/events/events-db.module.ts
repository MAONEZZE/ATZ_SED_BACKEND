import { Module } from '@nestjs/common';
import { EVENT_REPOSITORY_PORT } from '@domain/events/ports/event-repository.port';
import { PrismaEventRepository } from './prisma-event.repository';

@Module({
  providers: [
    { provide: EVENT_REPOSITORY_PORT, useClass: PrismaEventRepository },
  ],
  exports: [EVENT_REPOSITORY_PORT],
})
export class EventsDbModule {}
