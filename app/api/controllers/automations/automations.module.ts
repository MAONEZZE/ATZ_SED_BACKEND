import { Module } from '@nestjs/common';
import { AutomationEngine } from '@services/automations/automation-engine.service';
import { TemplateRenderer } from '@services/automations/template-renderer.service';
import { AutomationsService } from '@services/automations/automations.service';
import { ScheduledAutomationsWorker } from '@api/workers/scheduled-automations.worker';
import { BullQueuesModule } from '@database/queue/bull-queues.module';
import { AutomationsDbModule } from '@database/automations/automations-db.module';
import { WorkersModule } from '@api/workers/workers.module';
import { AutomationsController } from './automations_routes/automations.controller';
import { GuardsModule } from '@api/config/guards/guards.module';

@Module({
  imports: [BullQueuesModule, WorkersModule, GuardsModule, AutomationsDbModule],
  controllers: [AutomationsController],
  providers: [AutomationEngine, TemplateRenderer, AutomationsService, ScheduledAutomationsWorker],
  exports: [AutomationEngine, TemplateRenderer],
})
export class AutomationsModule {}
