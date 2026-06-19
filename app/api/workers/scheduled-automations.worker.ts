import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '@database/prisma/prisma.service';
import { AutomationEngine } from '@services/automations/automation-engine.service';
import { QUEUE_SCHEDULED_AUTOMATIONS } from '@database/queue/bull-queues.module';

const TOLERANCE_BEFORE_MS = 2 * 60 * 60 * 1000;
const TOLERANCE_AFTER_MS = 24 * 60 * 60 * 1000;

const SCHEDULER_ID = 'scheduled-automations-recurring';

@Processor(QUEUE_SCHEDULED_AUTOMATIONS, {
  stalledInterval: Number(process.env.QUEUE_STALLED_INTERVAL_MS) || 600_000,
  lockDuration: 60_000,
  lockRenewTime: 30_000,
  drainDelay: 5_000,
})
@Injectable()
export class ScheduledAutomationsWorker extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(ScheduledAutomationsWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: AutomationEngine,
    @InjectQueue(QUEUE_SCHEDULED_AUTOMATIONS) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const intervalMs = Number(process.env.SCHEDULED_AUTOMATIONS_INTERVAL_MS) || 120_000;

    const existing = await this.queue.getJobSchedulers();
    await Promise.all(
      existing
        .filter((s) => s.key !== SCHEDULER_ID)
        .map((s) => this.queue.removeJobScheduler(s.key)),
    );

    await this.queue.upsertJobScheduler(
      SCHEDULER_ID,
      { every: intervalMs },
      { name: 'check-scheduled' },
    );
    this.logger.log(`Scheduled automations recurring job registered (every ${intervalMs}ms)`);
  }

  async process(_job: Job): Promise<void> {
    await Promise.allSettled([
      this.processScheduledTrigger('before_event'),
      this.processScheduledTrigger('after_event'),
      this.processScheduledTrigger('after_approval'),
    ]);
  }

  private async processScheduledTrigger(trigger: string): Promise<void> {
    const rules = await this.prisma.automationRule.findMany({
      where: {
        trigger: trigger as any,
        active: true,
        delayMinutes: { not: null },
      },
      include: {
        event: {
          include: {
            registrations: {
              where: { status: 'approved' },
            },
          },
        },
      },
    });

    const now = Date.now();

    for (const rule of rules) {
      if (!rule.event.eventDate && trigger !== 'after_approval') continue;

      for (const reg of rule.event.registrations) {
        try {
          const shouldFire = this.shouldFire(trigger, rule, reg, now);
          if (!shouldFire) continue;

          await this.engine.fireAutomations(reg.id, rule.event.id, trigger, [rule.id]);
        } catch (err) {
          this.logger.error(
            { err, registrationId: reg.id, trigger },
            'Scheduled automation failed',
          );
        }
      }
    }
  }

  private shouldFire(
    trigger: string,
    rule: { delayMinutes: number | null; event: { eventDate: Date | null } },
    reg: { updatedAt: Date },
    now: number,
  ): boolean {
    const delayMs = (rule.delayMinutes ?? 0) * 60 * 1000;

    if (trigger === 'before_event' && rule.event.eventDate) {
      const fireAt = rule.event.eventDate.getTime() - delayMs;
      return Math.abs(now - fireAt) <= TOLERANCE_BEFORE_MS;
    }

    if (trigger === 'after_event' && rule.event.eventDate) {
      const fireAt = rule.event.eventDate.getTime() + delayMs;
      return Math.abs(now - fireAt) <= TOLERANCE_AFTER_MS;
    }

    if (trigger === 'after_approval') {
      const fireAt = reg.updatedAt.getTime() + delayMs;
      return now >= fireAt && now - fireAt <= TOLERANCE_AFTER_MS;
    }

    return false;
  }
}
