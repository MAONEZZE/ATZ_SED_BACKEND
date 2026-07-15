import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AutomationsRepository } from '@modules/automations/automations.repository';
import { RecurringSchedulerService } from '@modules/automations/recurring-scheduler.service';

export interface CreateAutomationInput {
  templateId: string;
  trigger: string;
  delayMinutes?: number | null;
  cron?: string | null;
  timezone?: string | null;
  active?: boolean;
}

export interface UpdateAutomationInput {
  templateId?: string;
  trigger?: string;
  delayMinutes?: number | null;
  cron?: string | null;
  timezone?: string | null;
  active?: boolean;
}

interface RecurringSyncable {
  id: string;
  trigger: string;
  active: boolean;
  cron: string | null;
  timezone: string | null;
}

@Injectable()
export class AutomationsService {
  constructor(
    private readonly repo: AutomationsRepository,
    private readonly scheduler: RecurringSchedulerService,
  ) {}

  listPaginated(eventId: string, page: number, limit: number) {
    return this.repo.findAllByEventPaginated(eventId, { skip: (page - 1) * limit, take: limit });
  }

  /** All automations across the user's events (owner or collaborator), with event + template. */
  listForUser(userId: string, page: number, limit: number) {
    return this.repo.findAllForUserPaginated(userId, { skip: (page - 1) * limit, take: limit });
  }

  async findOne(eventId: string, id: string) {
    const rule = await this.repo.findOneWithTemplate(eventId, id);
    if (!rule) throw new NotFoundException('Automation rule not found');
    return rule;
  }

  async create(eventId: string, input: CreateAutomationInput) {
    await this.assertTemplateExists(input.templateId);
    this.assertRecurringScheduleValid(input.trigger, input.cron, input.timezone);
    if (input.active !== false && input.trigger !== 'recurring') {
      await this.assertNoActiveDuplicate(eventId, input.trigger);
    }
    const rule = await this.repo.create({
      eventId,
      templateId: input.templateId,
      trigger: input.trigger as Prisma.AutomationRuleUncheckedCreateInput['trigger'],
      // delayMinutes nulo = disparo imediato. O front pode mandar 0 com a mesma
      // intenção; normalizamos 0 -> null para a regra não cair no buraco entre o
      // disparo imediato (engine) e o agendado (worker).
      delayMinutes: input.delayMinutes || null,
      cron: input.trigger === 'recurring' ? (input.cron ?? null) : null,
      timezone: input.trigger === 'recurring' ? (input.timezone ?? null) : null,
      active: input.active ?? true,
    });
    await this.syncRecurringScheduler(rule);
    return rule;
  }

  async update(eventId: string, id: string, input: UpdateAutomationInput) {
    const existing = await this.repo.findByEvent(eventId, id);
    if (!existing) throw new NotFoundException('Automation rule not found');
    if (input.templateId) await this.assertTemplateExists(input.templateId);

    const willBeActive = input.active ?? existing.active;
    const trigger = input.trigger ?? existing.trigger;
    const cron = input.cron !== undefined ? input.cron : existing.cron;
    const timezone = input.timezone !== undefined ? input.timezone : existing.timezone;
    this.assertRecurringScheduleValid(trigger, cron, timezone);

    if (willBeActive && trigger !== 'recurring' && (input.trigger || input.active === true)) {
      await this.assertNoActiveDuplicate(eventId, trigger, id);
    }

    const updated = await this.repo.update(id, {
      ...(input.templateId && { templateId: input.templateId }),
      ...(input.trigger && {
        trigger: input.trigger as Prisma.AutomationRuleUncheckedUpdateInput['trigger'],
      }),
      ...(input.delayMinutes !== undefined && { delayMinutes: input.delayMinutes || null }),
      ...(input.cron !== undefined && { cron: input.cron }),
      ...(input.timezone !== undefined && { timezone: input.timezone }),
      ...(input.active !== undefined && { active: input.active }),
    });
    await this.syncRecurringScheduler(updated);
    return updated;
  }

  async delete(eventId: string, id: string): Promise<void> {
    const existing = await this.repo.findByEvent(eventId, id);
    if (!existing) throw new NotFoundException('Automation rule not found');
    await this.repo.delete(id);
    if (existing.trigger === 'recurring') {
      await this.scheduler.remove(id);
    }
  }

  private assertRecurringScheduleValid(
    trigger: string,
    cron?: string | null,
    timezone?: string | null,
  ): void {
    if (trigger !== 'recurring') return;
    if (!cron) throw new BadRequestException('cron é obrigatório para trigger "recurring"');
    if (!timezone) throw new BadRequestException('timezone é obrigatório para trigger "recurring"');
  }

  private async syncRecurringScheduler(rule: RecurringSyncable): Promise<void> {
    if (rule.trigger === 'recurring' && rule.active && rule.cron && rule.timezone) {
      await this.scheduler.upsert({ id: rule.id, cron: rule.cron, timezone: rule.timezone });
    } else {
      await this.scheduler.remove(rule.id);
    }
  }

  private async assertTemplateExists(templateId: string): Promise<void> {
    const template = await this.repo.templateById(templateId);
    if (!template) throw new NotFoundException('Template not found');
  }

  private async assertNoActiveDuplicate(
    eventId: string,
    trigger: string,
    excludeId?: string,
  ): Promise<void> {
    const duplicate = await this.repo.findActiveByEventAndTrigger(eventId, trigger, excludeId);
    if (duplicate) {
      throw new ConflictException(
        `An active automation for trigger '${trigger}' already exists on this event`,
      );
    }
  }
}
