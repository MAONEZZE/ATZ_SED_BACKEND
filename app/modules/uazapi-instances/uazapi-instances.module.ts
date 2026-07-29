import { Module } from '@nestjs/common';
import { UazapiInstancesController } from './uazapi-instances.controller';
import { UazapiInstancesService } from './uazapi-instances.service';
import { UazapiInstancesRepository } from './uazapi-instances.repository';
import { GuardsModule } from '@shared/guards/guards.module';
import { IntegrationsModule } from '@infra/integrations/integrations.module';

@Module({
  imports: [GuardsModule, IntegrationsModule],
  controllers: [UazapiInstancesController],
  providers: [UazapiInstancesService, UazapiInstancesRepository],
  exports: [UazapiInstancesService, UazapiInstancesRepository],
})
export class UazapiInstancesModule {}
