import { Module } from '@nestjs/common';
import { EVENT_REPOSITORY_PORT } from '@modules/events/ports/event-repository.port';
import { PrismaEventRepository } from './prisma-event.repository';
import { FormFieldsRepository } from './form-fields.repository';

@Module({
  providers: [
    { provide: EVENT_REPOSITORY_PORT, useClass: PrismaEventRepository },
    FormFieldsRepository,
  ],
  exports: [EVENT_REPOSITORY_PORT, FormFieldsRepository],
})
export class EventsDbModule {}
