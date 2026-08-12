import { Global, Module } from '@nestjs/common';
import { AUTOMATION_REPOSITORY_PORT } from '@domain/automation_module/i-repository-automation';
import { PrismaAutomationRepository } from './prisma-automation.repository';

@Global()
@Module({
  providers: [{ provide: AUTOMATION_REPOSITORY_PORT, useClass: PrismaAutomationRepository }],
  exports: [AUTOMATION_REPOSITORY_PORT],
})
export class AutomationsDbModule {}
