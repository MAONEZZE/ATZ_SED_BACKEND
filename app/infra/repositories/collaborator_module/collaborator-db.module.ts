import { Global, Module } from '@nestjs/common';
import { COLLABORATOR_REPOSITORY_PORT } from '@domain/collaborator_module/i-repository-collaborator';
import { PrismaCollaboratorRepository } from './prisma-collaborator.repository';

@Global()
@Module({
  providers: [{ provide: COLLABORATOR_REPOSITORY_PORT, useClass: PrismaCollaboratorRepository }],
  exports: [COLLABORATOR_REPOSITORY_PORT],
})
export class CollaboratorDbModule {}
