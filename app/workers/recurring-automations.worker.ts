import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '@infra/prisma/prisma.service';
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
    private readonly prisma: PrismaService,
    private readonly engine: AutomationEngine,
    private readonly scheduler: RecurringSchedulerService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const rules = await this.prisma.automationRule.findMany({
      where: { trigger: 'recurring', active: true },
      select: { id: true, cron: true, timezone: true },
    });
    await this.scheduler.syncAll(rules);
  }

  async process(job: Job<{ ruleId: string }>): Promise<void> {
    const { ruleId } = job.data;
    const rule = await this.prisma.automationRule.findUnique({ where: { id: ruleId } });
    if (!rule || !rule.active || rule.trigger !== 'recurring') {
      this.logger.warn(
        { ruleId },
        'Recurring automation rule missing/inactive/wrong trigger — skipping occurrence',
      );
      return;
    }

    const event = await this.prisma.event.findUnique({
      where: { id: rule.eventId },
      include: { registrations: { where: { status: 'approved' } } },
    });
    if (!event) {
      this.logger.warn({ ruleId, eventId: rule.eventId }, 'Event not found for recurring automation');
      return;
    }

    for (const reg of event.registrations) {
      try {
        await this.engine.fireAutomations(reg.id, event.id, 'recurring', [rule.id]);
      } catch (err) {
        this.logger.error({ err, registrationId: reg.id, ruleId }, 'Recurring automation failed');
      }
    }
  }
}
