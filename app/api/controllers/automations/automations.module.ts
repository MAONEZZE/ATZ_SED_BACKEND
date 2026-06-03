import { Module } from '@nestjs/common';
import { AutomationEngine } from '@services/automations/automation-engine.service';
import { TemplateRenderer } from '@services/automations/template-renderer.service';
import { IcsGeneratorService } from '@services/automations/ics-generator.service';
import { ScheduledAutomationsWorker } from '@api/workers/scheduled-automations.worker';
import { BullQueuesModule } from '@database/queue/bull-queues.module';
import { WorkersModule } from '@api/workers/workers.module';

@Module({
  imports: [BullQueuesModule, WorkersModule],
  providers: [
    AutomationEngine,
    TemplateRenderer,
    IcsGeneratorService,
    ScheduledAutomationsWorker,
  ],
  exports: [AutomationEngine, TemplateRenderer],
})
export class AutomationsModule {}
