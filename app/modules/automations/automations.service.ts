import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AutomationsRepository } from '@modules/automations/automations.repository';

export interface CreateAutomationInput {
  templateId: string;
  trigger: string;
  delayMinutes?: number | null;
  active?: boolean;
}

export interface UpdateAutomationInput {
  templateId?: string;
  trigger?: string;
  delayMinutes?: number | null;
  active?: boolean;
}

@Injectable()
export class AutomationsService {
  constructor(private readonly repo: AutomationsRepository) {}

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
    return this.repo.create({
      eventId,
      templateId: input.templateId,
      trigger: input.trigger as Prisma.AutomationRuleUncheckedCreateInput['trigger'],
      // delayMinutes nulo = disparo imediato. O front pode mandar 0 com a mesma
      // intenção; normalizamos 0 -> null para a regra não cair no buraco entre o
      // disparo imediato (engine) e o agendado (worker).
      delayMinutes: input.delayMinutes || null,
      active: input.active ?? true,
    });
  }

  async update(eventId: string, id: string, input: UpdateAutomationInput) {
    const existing = await this.repo.findByEvent(eventId, id);
    if (!existing) throw new NotFoundException('Automation rule not found');
    if (input.templateId) await this.assertTemplateExists(input.templateId);

    return this.repo.update(id, {
      ...(input.templateId && { templateId: input.templateId }),
      ...(input.trigger && {
        trigger: input.trigger as Prisma.AutomationRuleUncheckedUpdateInput['trigger'],
      }),
      ...(input.delayMinutes !== undefined && { delayMinutes: input.delayMinutes || null }),
      ...(input.active !== undefined && { active: input.active }),
    });
  }

  async delete(eventId: string, id: string): Promise<void> {
    const existing = await this.repo.findByEvent(eventId, id);
    if (!existing) throw new NotFoundException('Automation rule not found');
    await this.repo.delete(id);
  }

  private async assertTemplateExists(templateId: string): Promise<void> {
    const template = await this.repo.templateById(templateId);
    if (!template) throw new NotFoundException('Template not found');
  }
}
