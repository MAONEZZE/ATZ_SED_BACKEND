import { Module } from '@nestjs/common';
import { AutomationEngine } from '@modules/automations/automation-engine.service';
import { TemplateRenderer } from '@application/shared/template-renderer.service';
import { AutomationsService } from '@modules/automations/automations.service';
import { RecurringSchedulerService } from '@modules/automations/recurring-scheduler.service';
import { RecurringAutomationsWorker } from '@application/workers/recurring-automations.worker';
import { BullQueuesModule } from '@infra/queue/bull-queues.module';
import { AutomationsDbModule } from '@modules/automations/automations-db.module';
import { OutboxModule } from '@domain/outbox_module/outbox.module';
import { AutomationsController } from './automations.controller';
import { GlobalAutomationsController } from './global-automations.controller';
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
