import { Module } from '@nestjs/common';
import { AutomationEngine } from '@services/automations/automation-engine.service';
import { TemplateRenderer } from '@services/automations/template-renderer.service';
import { ScheduledAutomationsWorker } from '@api/workers/scheduled-automations.worker';
import { BullQueuesModule } from '@database/queue/bull-queues.module';
import { WorkersModule } from '@api/workers/workers.module';
import { AutomationsController } from './automations_routes/automations.controller';
import { GuardsModule } from '@api/config/guards/guards.module';

@Module({
  imports: [BullQueuesModule, WorkersModule, GuardsModule],
  controllers: [AutomationsController],
  providers: [AutomationEngine, TemplateRenderer, ScheduledAutomationsWorker],
  exports: [AutomationEngine, TemplateRenderer],
})
export class AutomationsModule {}
