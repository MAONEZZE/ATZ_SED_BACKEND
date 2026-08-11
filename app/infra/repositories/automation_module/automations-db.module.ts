import { Global, Module } from '@nestjs/common';
import { AutomationsRepository } from './automations.repository';

@Global()
@Module({
  providers: [AutomationsRepository],
  exports: [AutomationsRepository],
})
export class AutomationsDbModule {}
