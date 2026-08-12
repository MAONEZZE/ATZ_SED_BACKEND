import { Module } from '@nestjs/common';
import { CollaboratorsController } from '@api/controllers/collaborator_module/collaborators.controller';
import { CollaboratorsService } from '@application/collaborator_module/collaborators.service';
import { CollaboratorsDbModule } from '@infra/repositories/collaborator_module/collaborators-db.module';
import { GuardsModule } from '@api/config/modules/guards.module';

@Module({
  imports: [CollaboratorsDbModule, GuardsModule],
  controllers: [CollaboratorsController],
  providers: [CollaboratorsService],
  exports: [CollaboratorsService],
})
export class CollaboratorsModule {}
