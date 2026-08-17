import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaRepositoryBase } from '@infra/repositories/shared/prisma-repository.base';
import { MessageChannel } from '@domain/shared/message-channel.type';
import { EventDuplicationAutomationRule } from '@domain/event_module/i-repository-event';
import { MessageTemplateEntity } from '@domain/message_template_module/message-template.entity';
import {
  AutomationRuleEntity,
  AutomationTrigger,
} from '@domain/automation_module/automation-rule.entity';
import {
  AutomationRepositoryPort,
  AutomationRuleWithEventAndTemplate,
  AutomationRuleWithFullTemplate,
  AutomationRuleWithTemplate,
  CreateAutomationRuleData,
  RecurringSchedule,
  UpdateAutomationRuleData,
} from '@domain/automation_module/i-repository-automation';

const TEMPLATE_SUMMARY = {
  template: { select: { id: true, name: true, channel: true } },
} as const;

type AutomationRuleRow = {
  id: string;
  eventId: string;
  templateId: string;
  formId: string | null;
  trigger: string;
  delayMinutes: number | null;
  cron: string | null;
  timezone: string | null;
  active: boolean;
  createdAt: Date;
};

type MessageTemplateRow = {
  id: string;
  ownerId: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
  layoutConfig: Prisma.JsonValue;
  styleKey: string | null;
  eventId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaAutomationRepository
  extends PrismaRepositoryBase
  implements AutomationRepositoryPort
{
  private toEntity(row: AutomationRuleRow): AutomationRuleEntity {
    return new AutomationRuleEntity(
      row.id,
      row.eventId,
      row.templateId,
      row.trigger as AutomationTrigger,
      row.formId,
      row.delayMinutes,
      row.cron,
      row.timezone,
      row.active,
      row.createdAt,
    );
  }

  private toTemplateEntity(row: MessageTemplateRow): MessageTemplateEntity {
    return new MessageTemplateEntity(
      row.id,
      row.ownerId,
      row.name,
      row.channel as MessageChannel,
      row.subject,
      row.body,
      row.layoutConfig && typeof row.layoutConfig === 'object'
        ? (row.layoutConfig as Record<string, unknown>)
        : null,
      row.styleKey,
      row.eventId,
      row.createdAt,
      row.updatedAt,
    );
  }

  /** Anexa o resumo à entidade em vez de embrulhá-la: a lista vai serializada. */
  private withTemplate(
    row: AutomationRuleRow & { template: { id: string; name: string; channel: string } },
  ): AutomationRuleWithTemplate {
    return Object.assign(this.toEntity(row), {
      template: { ...row.template, channel: row.template.channel as MessageChannel },
    });
  }

  private withFullTemplate(
    row: AutomationRuleRow & { template: MessageTemplateRow },
  ): AutomationRuleWithFullTemplate {
    return Object.assign(this.toEntity(row), { template: this.toTemplateEntity(row.template) });
  }

  async findAllByEventPaginated(
    eventId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ data: AutomationRuleWithTemplate[]; total: number }> {
    const where = { eventId };
    const [rows, total] = await Promise.all([
      this.prisma.automationRule.findMany({
        where,
        include: TEMPLATE_SUMMARY,
        orderBy: { createdAt: 'asc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.automationRule.count({ where }),
    ]);
    return { data: rows.map((row) => this.withTemplate(row)), total };
  }

  async findAllForUserPaginated(
    userId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ data: AutomationRuleWithEventAndTemplate[]; total: number }> {
    const where = {
      event: { OR: [{ ownerId: userId }, { collaborators: { some: { profileId: userId } } }] },
    };
    const [rows, total] = await Promise.all([
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
    const data = rows.map((row) =>
      Object.assign(this.withTemplate(row), { event: row.event }),
    ) as AutomationRuleWithEventAndTemplate[];
    return { data, total };
  }

  findAllRecurringActive(): Promise<RecurringSchedule[]> {
    return this.prisma.automationRule.findMany({
      where: { trigger: 'recurring', active: true },
      select: { id: true, cron: true, timezone: true },
    });
  }

  async findById(id: string): Promise<AutomationRuleEntity | null> {
    const row = await this.prisma.automationRule.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findByEvent(eventId: string, id: string): Promise<AutomationRuleEntity | null> {
    const row = await this.prisma.automationRule.findFirst({ where: { id, eventId } });
    return row ? this.toEntity(row) : null;
  }

  async findOneWithTemplate(
    eventId: string,
    id: string,
  ): Promise<AutomationRuleWithFullTemplate | null> {
    const row = await this.prisma.automationRule.findFirst({
      where: { id, eventId },
      include: { template: true },
    });
    return row ? this.withFullTemplate(row) : null;
  }

  async findActiveByEventTriggerAndTemplate(
    eventId: string,
    trigger: string,
    templateId: string,
    excludeId?: string,
  ): Promise<AutomationRuleEntity | null> {
    const row = await this.prisma.automationRule.findFirst({
      where: {
        eventId,
        trigger: trigger as Prisma.AutomationRuleUncheckedCreateInput['trigger'],
        templateId,
        active: true,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
    return row ? this.toEntity(row) : null;
  }

  // Com `eventId`, só aceita template do próprio evento ou global — antes um id
  // conhecido de template de outro evento passava.
  async templateById(templateId: string, eventId?: string): Promise<MessageTemplateEntity | null> {
    const row = await this.prisma.messageTemplate.findFirst({
      where: {
        id: templateId,
        ...(eventId && { OR: [{ eventId }, { eventId: null }] }),
      },
    });
    return row ? this.toTemplateEntity(row) : null;
  }

  async create(data: CreateAutomationRuleData): Promise<AutomationRuleWithTemplate> {
    const row = await this.prisma.automationRule.create({
      data: {
        eventId: data.eventId,
        templateId: data.templateId,
        trigger: data.trigger,
        delayMinutes: data.delayMinutes ?? null,
        cron: data.cron ?? null,
        timezone: data.timezone ?? null,
        ...(data.active !== undefined && { active: data.active }),
      },
      include: TEMPLATE_SUMMARY,
    });
    return this.withTemplate(row);
  }

  async update(id: string, data: UpdateAutomationRuleData): Promise<AutomationRuleWithTemplate> {
    const payload: Prisma.AutomationRuleUncheckedUpdateInput = {
      ...(data.templateId !== undefined && { templateId: data.templateId }),
      ...(data.trigger !== undefined && { trigger: data.trigger }),
      ...(data.delayMinutes !== undefined && { delayMinutes: data.delayMinutes }),
      ...(data.cron !== undefined && { cron: data.cron }),
      ...(data.timezone !== undefined && { timezone: data.timezone }),
      ...(data.active !== undefined && { active: data.active }),
    };
    const row = await this.prisma.automationRule.update({
      where: { id },
      data: payload,
      include: TEMPLATE_SUMMARY,
    });
    return this.withTemplate(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.automationRule.delete({ where: { id } });
  }

  /**
   * Regras ativas de um evento+trigger. `ruleIds` filtra pelo conjunto exato
   * (usado pelo worker de recorrência); sem isso, dispara imediato: apenas
   * regras sem delay (null ou 0, robustez contra regras gravadas com 0).
   */
  async findActiveTriggerRules(
    eventId: string,
    trigger: string,
    ruleIds?: string[],
  ): Promise<AutomationRuleWithFullTemplate[]> {
    const rows = await this.prisma.automationRule.findMany({
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
    return rows.map((row) => this.withFullTemplate(row));
  }

  createManyForDuplication(
    eventId: string,
    rules: EventDuplicationAutomationRule[],
  ): Promise<{ count: number }> {
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
