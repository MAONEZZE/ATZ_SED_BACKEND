import { Module } from '@nestjs/common';
import { AutomationEngine } from '@modules/automations/automation-engine.service';
import { TemplateRenderer } from '@modules/automations/template-renderer.service';
import { AutomationsService } from '@modules/automations/automations.service';
import { ScheduledAutomationsWorker } from '@workers/scheduled-automations.worker';
import { BullQueuesModule } from '@infra/queue/bull-queues.module';
import { AutomationsDbModule } from '@modules/automations/automations-db.module';
import { WorkersModule } from '@workers/workers.module';
import { AutomationsController } from './automations.controller';
import { GuardsModule } from '@shared/guards/guards.module';

@Module({
  imports: [BullQueuesModule, WorkersModule, GuardsModule, AutomationsDbModule],
  controllers: [AutomationsController],
  providers: [AutomationEngine, TemplateRenderer, AutomationsService, ScheduledAutomationsWorker],
  exports: [AutomationEngine, TemplateRenderer],
})
export class AutomationsModule {}
