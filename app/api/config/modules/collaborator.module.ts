import { Module } from '@nestjs/common';
import { CollaboratorController } from '@api/controllers/collaborator_module/collaborator.controller';
import { CollaboratorService } from '@application/collaborator_module/collaborator.service';
import { CollaboratorDbModule } from '@infra/repositories/collaborator_module/collaborator-db.module';
import { GuardsModule } from '@api/config/modules/guards.module';

@Module({
  imports: [CollaboratorDbModule, GuardsModule],
  controllers: [CollaboratorController],
  providers: [CollaboratorService],
  exports: [CollaboratorService],
})
export class CollaboratorModule {}
