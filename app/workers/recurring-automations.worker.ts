import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import { AutomationsRepository } from '@modules/automations/automations.repository';
import {
  EVENT_REPOSITORY_PORT,
  EventRepositoryPort,
} from '@modules/events/ports/event-repository.port';
import { AutomationEngine } from '@modules/automations/automation-engine.service';
import { RecurringSchedulerService } from '@modules/automations/recurring-scheduler.service';
import { QUEUE_RECURRING_AUTOMATIONS } from '@infra/queue/bull-queues.module';

@Processor(QUEUE_RECURRING_AUTOMATIONS, {
  stalledInterval: Number(process.env.QUEUE_STALLED_INTERVAL_MS) || 600_000,
  lockDuration: 60_000,
  lockRenewTime: 30_000,
  drainDelay: 5_000,
})
@Injectable()
export class RecurringAutomationsWorker extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(RecurringAutomationsWorker.name);

  constructor(
    private readonly automations: AutomationsRepository,
    @Inject(EVENT_REPOSITORY_PORT) private readonly eventRepo: EventRepositoryPort,
    private readonly engine: AutomationEngine,
    private readonly scheduler: RecurringSchedulerService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const rules = await this.automations.findAllRecurringActive();
    await this.scheduler.syncAll(rules);
  }

  async process(job: Job<{ ruleId: string }>): Promise<void> {
    const { ruleId } = job.data;
    const rule = await this.automations.findById(ruleId);
    if (!rule || !rule.active || rule.trigger !== 'recurring') {
      this.logger.warn(
        { ruleId },
        'Recurring automation rule missing/inactive/wrong trigger — skipping occurrence',
      );
      return;
    }

    const event = await this.eventRepo.findWithApprovedRegistrationIds(rule.eventId);
    if (!event) {
      this.logger.warn({ ruleId, eventId: rule.eventId }, 'Event not found for recurring automation');
      return;
    }

    for (const registrationId of event.registrationIds) {
      try {
        await this.engine.fireAutomations(registrationId, event.id, 'recurring', [rule.id]);
      } catch (err) {
        this.logger.error({ err, registrationId, ruleId }, 'Recurring automation failed');
      }
    }
  }
}
