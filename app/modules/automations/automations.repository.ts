import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaRepositoryBase } from '@infra/repositories/shared/prisma-repository.base';
import { EventDuplicationAutomationRule } from '@modules/events/ports/event-repository.port';

const TEMPLATE_SUMMARY = {
  template: { select: { id: true, name: true, channel: true } },
} as const;

@Injectable()
export class AutomationsRepository extends PrismaRepositoryBase {
  async findAllByEventPaginated(
    eventId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ data: object[]; total: number }> {
    const where = { eventId };
    const [data, total] = await Promise.all([
      this.prisma.automationRule.findMany({
        where,
        include: TEMPLATE_SUMMARY,
        orderBy: { createdAt: 'asc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.automationRule.count({ where }),
    ]);
    return { data, total };
  }

  async findAllForUserPaginated(
    userId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ data: object[]; total: number }> {
    const where = {
      event: { OR: [{ ownerId: userId }, { collaborators: { some: { profileId: userId } } }] },
    };
    const [data, total] = await Promise.all([
      this.prisma.automationRule.findMany({
        where,
        include: {
          event: { select: { id: true, title: true } },
          template: { select: { id: true, name: true, channel: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.automationRule.count({ where }),
    ]);
    return { data, total };
  }

  findAllRecurringActive() {
    return this.prisma.automationRule.findMany({
      where: { trigger: 'recurring', active: true },
      select: { id: true, cron: true, timezone: true },
    });
  }

  findById(id: string) {
    return this.prisma.automationRule.findUnique({ where: { id } });
  }

  findOneWithTemplate(eventId: string, id: string) {
    return this.prisma.automationRule.findFirst({
      where: { id, eventId },
      include: { template: true },
    });
  }

  findByEvent(eventId: string, id: string) {
    return this.prisma.automationRule.findFirst({ where: { id, eventId } });
  }

  findActiveByEventAndTrigger(eventId: string, trigger: string, excludeId?: string) {
    return this.prisma.automationRule.findFirst({
      where: {
        eventId,
        trigger: trigger as Prisma.AutomationRuleUncheckedCreateInput['trigger'],
        active: true,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
  }

  templateById(templateId: string) {
    return this.prisma.messageTemplate.findFirst({ where: { id: templateId } });
  }

  create(data: Prisma.AutomationRuleUncheckedCreateInput) {
    return this.prisma.automationRule.create({ data, include: TEMPLATE_SUMMARY });
  }

  update(id: string, data: Prisma.AutomationRuleUncheckedUpdateInput) {
    return this.prisma.automationRule.update({ where: { id }, data, include: TEMPLATE_SUMMARY });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.automationRule.delete({ where: { id } });
  }

  /**
   * Regras ativas de um evento+trigger. `ruleIds` filtra pelo conjunto exato
   * (usado pelo worker de recorrência); sem isso, dispara imediato: apenas
   * regras sem delay (null ou 0, robustez contra regras gravadas com 0).
   */
  findActiveTriggerRules(eventId: string, trigger: string, ruleIds?: string[]) {
    return this.prisma.automationRule.findMany({
      where: {
        eventId,
        trigger: trigger as Prisma.AutomationRuleUncheckedCreateInput['trigger'],
        active: true,
        ...(ruleIds
          ? { id: { in: ruleIds } }
          : { OR: [{ delayMinutes: null }, { delayMinutes: 0 }] }),
      },
      include: { template: true },
    });
  }

  createManyForDuplication(eventId: string, rules: EventDuplicationAutomationRule[]) {
    return this.prisma.automationRule.createMany({
      data: rules.map((a) => ({
        eventId,
        templateId: a.templateId,
        trigger: a.trigger as Prisma.AutomationRuleUncheckedCreateInput['trigger'],
        delayMinutes: a.delayMinutes ?? undefined,
        active: a.active,
      })),
    });
  }
}
