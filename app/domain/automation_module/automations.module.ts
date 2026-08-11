import { Module } from '@nestjs/common';
import { AutomationEngine } from '@application/automation_module/automation-engine.service';
import { TemplateRenderer } from '@application/shared/template-renderer.service';
import { AutomationsService } from '@application/automation_module/automations.service';
import { RecurringSchedulerService } from '@application/automation_module/recurring-scheduler.service';
import { RecurringAutomationsWorker } from '@application/workers/recurring-automations.worker';
import { BullQueuesModule } from '@infra/queue/bull-queues.module';
import { AutomationsDbModule } from '@infra/repositories/automation_module/automations-db.module';
import { OutboxModule } from '@domain/outbox_module/outbox.module';
import { AutomationsController } from '@api/controllers/automation_module/automations.controller';
import { GlobalAutomationsController } from '@api/controllers/automation_module/global-automations.controller';
import { GuardsModule } from '@api/config/modules/guards.module';
import { EventsDbModule } from '@infra/repositories/event_module/events-db.module';
import { RegistrationsDbModule } from '@infra/repositories/registration_module/registrations-db.module';

@Module({
  imports: [
    BullQueuesModule,
    OutboxModule,
    GuardsModule,
    AutomationsDbModule,
    EventsDbModule,
    RegistrationsDbModule,
  ],
  controllers: [AutomationsController, GlobalAutomationsController],
  providers: [
    AutomationEngine,
    TemplateRenderer,
    AutomationsService,
    RecurringSchedulerService,
    RecurringAutomationsWorker,
  ],
  exports: [AutomationEngine, TemplateRenderer, AutomationsService, RecurringSchedulerService],
})
export class AutomationsModule {}
