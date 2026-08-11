import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_RECURRING_AUTOMATIONS } from '@infra/queue/bull-queues.module';

const SCHEDULER_PREFIX = 'recurring-rule:';

@Injectable()
export class RecurringSchedulerService {
  private readonly logger = new Logger(RecurringSchedulerService.name);

  constructor(
    @InjectQueue(QUEUE_RECURRING_AUTOMATIONS) private readonly queue: Queue,
  ) {}

  private schedulerId(ruleId: string): string {
    return `${SCHEDULER_PREFIX}${ruleId}`;
  }

  /** Registers or refreshes the BullMQ job scheduler for a recurring rule's cron+timezone. */
  async upsert(rule: { id: string; cron: string; timezone: string }): Promise<void> {
    await this.queue.upsertJobScheduler(
      this.schedulerId(rule.id),
      { pattern: rule.cron, tz: rule.timezone },
      { name: 'fire', data: { ruleId: rule.id } },
    );
  }

  async remove(ruleId: string): Promise<void> {
    await this.queue.removeJobScheduler(this.schedulerId(ruleId));
  }

  /**
   * Boot-time reconciliation: upserts the scheduler for every active recurring
   * rule and drops schedulers whose rule is no longer active/recurring
   * (deleted, deactivated, or trigger changed away from `recurring`).
   */
  async syncAll(rules: Array<{ id: string; cron: string | null; timezone: string | null }>): Promise<void> {
    const activeIds = new Set(rules.map((r) => r.id));

    await Promise.all(
      rules
        .filter((r): r is { id: string; cron: string; timezone: string } => Boolean(r.cron && r.timezone))
        .map((r) => this.upsert(r)),
    );

    const existing = await this.queue.getJobSchedulers();
    const orphaned = existing.filter((s) => {
      if (!s.key.startsWith(SCHEDULER_PREFIX)) return false;
      return !activeIds.has(s.key.slice(SCHEDULER_PREFIX.length));
    });
    await Promise.all(orphaned.map((s) => this.queue.removeJobScheduler(s.key)));

    this.logger.log(
      `Recurring automations scheduler synced: ${rules.length} active rule(s), ${orphaned.length} orphaned scheduler(s) removed`,
    );
  }
}
