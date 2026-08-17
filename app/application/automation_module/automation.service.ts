import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  AutomationRuleEntity,
  AutomationTrigger,
} from '@domain/automation_module/automation-rule.entity';
import { AutomationValidator } from '@domain/automation_module/automation.validator';
import {
  AUTOMATION_REPOSITORY_PORT,
  AutomationRepositoryPort,
} from '@domain/automation_module/i-repository-automation';
import { RecurringSchedulerService } from '@application/automation_module/recurring-scheduler.service';
import { FORM_REPOSITORY_PORT, FormRepositoryPort } from '@domain/form_module/i-repository-form';
import {
  FOLDER_REPOSITORY_PORT,
  FolderRepositoryPort,
} from '@domain/folder_module/i-repository-folder';

export interface CreateAutomationInput {
  templateId: string;
  trigger: string;
  formId?: string | null;
  delayMinutes?: number | null;
  cron?: string | null;
  timezone?: string | null;
  active?: boolean;
  folderId?: string | null;
}

export interface UpdateAutomationInput {
  templateId?: string;
  trigger?: string;
  formId?: string | null;
  delayMinutes?: number | null;
  cron?: string | null;
  timezone?: string | null;
  active?: boolean;
  folderId?: string | null;
}

interface RecurringSyncable {
  id: string;
  trigger: string;
  active: boolean;
  cron: string | null;
  timezone: string | null;
}

@Injectable()
export class AutomationService {
  constructor(
    @Inject(AUTOMATION_REPOSITORY_PORT)
    private readonly repo: AutomationRepositoryPort,
    private readonly scheduler: RecurringSchedulerService,
    @Inject(FORM_REPOSITORY_PORT) private readonly forms: FormRepositoryPort,
    @Inject(FOLDER_REPOSITORY_PORT) private readonly folders: FolderRepositoryPort,
  ) {}

  listPaginated(eventId: string, page: number, limit: number, folderId?: string | null) {
    return this.repo.findAllByEventPaginated(
      eventId,
      { skip: (page - 1) * limit, take: limit },
      folderId,
    );
  }

  /** `folderId` null reordena as regras que estão fora de pasta. */
  async reorder(eventId: string, folderId: string | null, ids: string[]): Promise<void> {
    if (folderId) await this.assertFolderBelongsToEvent(folderId, eventId);
    await this.repo.reorder(eventId, folderId, ids);
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
    await this.assertTemplateExists(input.templateId, eventId);
    this.assertRuleValid(input.trigger, input.cron, input.timezone, input.formId);
    if (input.formId) await this.assertFormBelongsToEvent(input.formId, eventId);
    if (input.folderId) await this.assertFolderBelongsToEvent(input.folderId, eventId);
    const formId = AutomationRuleEntity.acceptsForm(input.trigger) ? (input.formId ?? null) : null;
    // Gatilho repetido é permitido (e-mail + WhatsApp na mesma etapa, por
    // exemplo). Só a repetição do mesmo template no mesmo gatilho e formulário
    // é barrada — o mesmo template em formulários diferentes é caso legítimo.
    if (input.active !== false) {
      await this.assertNoActiveDuplicate(eventId, input.trigger, input.templateId, formId);
    }
    const rule = await this.repo.create({
      eventId,
      templateId: input.templateId,
      formId,
      trigger: input.trigger as AutomationTrigger,
      // delayMinutes nulo = disparo imediato. O front pode mandar 0 com a mesma
      // intenção; normalizamos 0 -> null para a regra não cair no buraco entre o
      // disparo imediato (engine) e o agendado (worker).
      delayMinutes: input.delayMinutes || null,
      cron: AutomationRuleEntity.isRecurring(input.trigger) ? (input.cron ?? null) : null,
      timezone: AutomationRuleEntity.isRecurring(input.trigger) ? (input.timezone ?? null) : null,
      active: input.active ?? true,
      folderId: input.folderId ?? null,
    });
    await this.syncRecurringScheduler(rule);
    return rule;
  }

  async update(eventId: string, id: string, input: UpdateAutomationInput) {
    const existing = await this.repo.findByEvent(eventId, id);
    if (!existing) throw new NotFoundException('Automation rule not found');
    if (input.templateId) await this.assertTemplateExists(input.templateId, eventId);
    if (input.folderId) await this.assertFolderBelongsToEvent(input.folderId, eventId);

    const willBeActive = input.active ?? existing.active;
    const trigger = input.trigger ?? existing.trigger;
    const templateId = input.templateId ?? existing.templateId;
    const cron = input.cron !== undefined ? input.cron : existing.cron;
    const timezone = input.timezone !== undefined ? input.timezone : existing.timezone;
    const mergedFormId = input.formId !== undefined ? input.formId : existing.formId;
    this.assertRuleValid(trigger, cron, timezone, mergedFormId);
    if (input.formId) await this.assertFormBelongsToEvent(input.formId, eventId);
    const formId = AutomationRuleEntity.acceptsForm(trigger) ? (mergedFormId ?? null) : null;

    // A regra vale sobre o resultado da mesclagem: trocar só o template também
    // pode colidir com outra regra ativa do mesmo gatilho e formulário.
    if (willBeActive && (input.trigger || input.templateId || input.active === true)) {
      await this.assertNoActiveDuplicate(eventId, trigger, templateId, formId, id);
    }

    const updated = await this.repo.update(id, {
      ...(input.templateId && { templateId: input.templateId }),
      ...(input.trigger && { trigger: input.trigger as AutomationTrigger }),
      // Comparar com o valor atual em vez de olhar só o corpo: trocar para um
      // gatilho que não aceita formulário tem que limpar o `formId` antigo, e
      // esse patch não menciona `formId`. Deixar a coluna suja bagunçaria a
      // chave de duplicata (trigger + template + formId).
      ...(formId !== existing.formId && { formId }),
      ...(input.delayMinutes !== undefined && { delayMinutes: input.delayMinutes || null }),
      ...(input.cron !== undefined && { cron: input.cron }),
      ...(input.timezone !== undefined && { timezone: input.timezone }),
      ...(input.active !== undefined && { active: input.active }),
      ...(input.folderId !== undefined && { folderId: input.folderId }),
    });
    await this.syncRecurringScheduler(updated);
    return updated;
  }

  async delete(eventId: string, id: string): Promise<void> {
    const existing = await this.repo.findByEvent(eventId, id);
    if (!existing) throw new NotFoundException('Automation rule not found');
    await this.repo.delete(id);
    if (existing.isRecurring()) {
      await this.scheduler.remove(id);
    }
  }

  private assertRuleValid(
    trigger: string,
    cron?: string | null,
    timezone?: string | null,
    formId?: string | null,
  ): void {
    const errors = new AutomationValidator().validate({ trigger, cron, timezone, formId });
    if (errors.length > 0) throw new BadRequestException(errors[0]);
  }

  /** O formulário do gatilho tem que ser do próprio evento. */
  private async assertFormBelongsToEvent(formId: string, eventId: string): Promise<void> {
    const form = await this.forms.findByIdAndEvent(formId, eventId);
    if (!form) throw new NotFoundException('Form not found');
  }

  /**
   * A pasta tem que ser de automação e do próprio evento: pasta de template, ou
   * pasta de outro evento, não organiza esta regra. Quem pode mexer nela já foi
   * decidido pelo `OwnershipGuard` da rota `events/:eventId/automations`.
   */
  private async assertFolderBelongsToEvent(folderId: string, eventId: string): Promise<void> {
    const folder = await this.folders.findById(folderId);
    if (!folder || folder.resourceType !== 'automation_rule' || folder.eventId !== eventId) {
      throw new NotFoundException('Folder not found');
    }
  }

  private async syncRecurringScheduler(rule: RecurringSyncable): Promise<void> {
    if (rule.trigger === 'recurring' && rule.active && rule.cron && rule.timezone) {
      await this.scheduler.upsert({ id: rule.id, cron: rule.cron, timezone: rule.timezone });
    } else {
      await this.scheduler.remove(rule.id);
    }
  }

  private async assertTemplateExists(templateId: string, eventId: string): Promise<void> {
    const template = await this.repo.templateById(templateId, eventId);
    if (!template) throw new NotFoundException('Template not found');
  }

  private async assertNoActiveDuplicate(
    eventId: string,
    trigger: string,
    templateId: string,
    formId: string | null,
    excludeId?: string,
  ): Promise<void> {
    const duplicate = await this.repo.findActiveByEventTriggerAndTemplate(
      eventId,
      trigger,
      templateId,
      formId,
      excludeId,
    );
    if (duplicate) {
      throw new ConflictException(
        `An active automation for trigger '${trigger}' with this template already exists on this event`,
      );
    }
  }
}
