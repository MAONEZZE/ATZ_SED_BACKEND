import { Module } from '@nestjs/common';
import { AutomationEngine } from '@application/automation_module/automation-engine.service';
import { TemplateRenderer } from '@application/shared/template-renderer.service';
import { AutomationService } from '@application/automation_module/automation.service';
import { RecurringSchedulerService } from '@application/automation_module/recurring-scheduler.service';
import { RecurringAutomationsWorker } from '@application/workers/recurring-automations.worker';
import { DateAutomationsService } from '@application/automation_module/date-automations.service';
import { FormFieldDateAutomationsService } from '@application/automation_module/form-field-date-automations.service';
import { BullQueuesModule } from '@infra/queue/bull-queues.module';
import { AutomationDbModule } from '@infra/repositories/automation_module/automation-db.module';
import { OutboxModule } from '@shared/modules/outbox.module';
import { AutomationController } from '@api/controllers/automation_module/automation.controller';
import { GlobalAutomationController } from '@api/controllers/automation_module/global-automation.controller';
import { GuardsModule } from '@shared/modules/guards.module';
import { EventDbModule } from '@infra/repositories/event_module/event-db.module';
import { RegistrationDbModule } from '@infra/repositories/registration_module/registration-db.module';
import { FormFieldDbModule } from '@infra/repositories/form_field_module/form-field-db.module';
import { FormResponseDbModule } from '@infra/repositories/form_response_module/form-response-db.module';

@Module({
  imports: [
    BullQueuesModule,
    OutboxModule,
    GuardsModule,
    AutomationDbModule,
    EventDbModule,
    RegistrationDbModule,
    FormFieldDbModule,
    FormResponseDbModule,
  ],
  controllers: [AutomationController, GlobalAutomationController],
  providers: [
    AutomationEngine,
    TemplateRenderer,
    AutomationService,
    RecurringSchedulerService,
    RecurringAutomationsWorker,
    DateAutomationsService,
    FormFieldDateAutomationsService,
  ],
  exports: [AutomationEngine, TemplateRenderer, AutomationService, RecurringSchedulerService],
})
export class AutomationModule {}
