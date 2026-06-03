import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiModule as AiInfraModule } from '@database/integrations/ai.module';
import { GuardsModule } from '@api/config/guards/guards.module';

@Module({
  imports: [AiInfraModule, GuardsModule],
  controllers: [AiController],
})
export class AiFeatureModule {}
