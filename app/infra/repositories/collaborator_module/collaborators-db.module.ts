import { Global, Module } from '@nestjs/common';
import { CollaboratorsRepository } from './collaborators.repository';

@Global()
@Module({
  providers: [CollaboratorsRepository],
  exports: [CollaboratorsRepository],
})
export class CollaboratorsDbModule {}
