import { Global, Module } from '@nestjs/common';
import { EVENT_REPOSITORY_PORT } from '@modules/events/ports/event-repository.port';
import { PrismaEventRepository } from './prisma-event.repository';
import { FormFieldsRepository } from './form-fields.repository';
import { FormsRepository } from './forms.repository';
import { CollaboratorsRepository } from './collaborators.repository';

@Global()
@Module({
  providers: [
    { provide: EVENT_REPOSITORY_PORT, useClass: PrismaEventRepository },
    FormFieldsRepository,
    FormsRepository,
    CollaboratorsRepository,
  ],
  exports: [EVENT_REPOSITORY_PORT, FormFieldsRepository, FormsRepository, CollaboratorsRepository],
})
export class EventsDbModule {}
