import { Module } from '@nestjs/common';
import { EvolutionInstancesController } from './evolution-instances.controller';
import { EvolutionInstancesService } from './evolution-instances.service';
import { EvolutionInstancesRepository } from './evolution-instances.repository';
import { GuardsModule } from '@shared/guards/guards.module';

@Module({
  imports: [GuardsModule],
  controllers: [EvolutionInstancesController],
  providers: [EvolutionInstancesService, EvolutionInstancesRepository],
  exports: [EvolutionInstancesRepository],
})
export class EvolutionInstancesModule {}
