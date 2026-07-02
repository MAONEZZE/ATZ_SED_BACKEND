import { Module } from '@nestjs/common';
import { AutomationsRepository } from './automations.repository';

@Module({
  providers: [AutomationsRepository],
  exports: [AutomationsRepository],
})
export class AutomationsDbModule {}
