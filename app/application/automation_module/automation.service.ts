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
import { DateTime } from 'luxon';
import { APP_TIMEZONE } from '@handlers/timezone';
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
  formIds?: string[];
  delayMinutes?: number | null;
  cron?: string | null;
  timezone?: string | null;
  /** ISO do disparo único de `on_date`, interpretado no `timezone` da regra. */
  sendAt?: string | null;
  active?: boolean;
  folderId?: string | null;
}

export interface UpdateAutomationInput {
  templateId?: string;
  trigger?: string;
  formIds?: string[];
  delayMinutes?: number | null;
  cron?: string | null;
  timezone?: string | null;
  sendAt?: string | null;
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

  async move(eventId: string, id: string, beforeId?: string): Promise<void> {
    const moved = await this.repo.move(eventId, id, beforeId);
    if (!moved) throw new NotFoundException('Automation rule not found');
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
    const sendAt = this.resolveSendAt(input.trigger, input.sendAt, input.timezone);
    this.assertRuleValid(input.trigger, input.cron, input.timezone, input.formIds, sendAt);
    this.assertSendAtFuture(input.trigger, sendAt, input.active ?? true, null);
    if (input.formIds?.length) await this.assertFormsBelongToEvent(input.formIds, eventId);
    if (input.folderId) await this.assertFolderBelongsToEvent(input.folderId, eventId);
    const formIds = AutomationRuleEntity.acceptsForm(input.trigger) ? (input.formIds ?? []) : [];
    // Gatilho repetido é permitido (e-mail + WhatsApp na mesma etapa, por
    // exemplo). Só a repetição do mesmo template no mesmo gatilho é barrada —
    // o mesmo template em formulários diferentes vira uma regra com dois
    // formIds, não duas regras.
    if (input.active !== false) {
      await this.assertNoActiveDuplicate(eventId, input.trigger, input.templateId, sendAt);
    }
    const rule = await this.repo.create({
      eventId,
      templateId: input.templateId,
      formIds,
      trigger: input.trigger as AutomationTrigger,
      // delayMinutes nulo = disparo imediato. O front pode mandar 0 com a mesma
      // intenção; normalizamos 0 -> null para a regra não cair no buraco entre o
      // disparo imediato (engine) e o agendado (worker).
      delayMinutes: input.delayMinutes || null,
      cron: AutomationRuleEntity.isRecurring(input.trigger) ? (input.cron ?? null) : null,
      // `on_date` também guarda fuso: é nele que o instante foi marcado, e a UI
      // precisa dele para mostrar a data de volta como o usuário digitou.
      timezone: this.resolveTimezone(input.trigger, input.timezone),
      sendAt,
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
    const mergedFormIds = input.formIds !== undefined ? input.formIds : existing.formIds;
    // Data nova recalculada no fuso mesclado; ausente no patch, vale a gravada.
    const sendAt =
      input.sendAt !== undefined
        ? this.resolveSendAt(trigger, input.sendAt, timezone)
        : AutomationRuleEntity.isDate(trigger)
          ? existing.sendAt
          : null;
    this.assertRuleValid(trigger, cron, timezone, mergedFormIds, sendAt);
    // Remarcar a data reabre o disparo, então a regra volta a valer como nova:
    // o `firedAt` gravado não a isenta da checagem de data futura.
    const sendAtChanged = sendAt?.getTime() !== existing.sendAt?.getTime();
    this.assertSendAtFuture(trigger, sendAt, willBeActive, sendAtChanged ? null : existing.firedAt);
    if (input.formIds?.length) await this.assertFormsBelongToEvent(input.formIds, eventId);
    const formIds = AutomationRuleEntity.acceptsForm(trigger) ? mergedFormIds : [];

    // A regra vale sobre o resultado da mesclagem: trocar só o template também
    // pode colidir com outra regra ativa do mesmo gatilho.
    // A data entra na condição: remarcar uma regra `on_date` para uma data já
    // ocupada pelo mesmo template também é duplicata.
    if (
      willBeActive &&
      (input.trigger || input.templateId || input.active === true || sendAtChanged)
    ) {
      await this.assertNoActiveDuplicate(eventId, trigger, templateId, sendAt, id);
    }

    const updated = await this.repo.update(id, {
      ...(input.templateId && { templateId: input.templateId }),
      ...(input.trigger && { trigger: input.trigger as AutomationTrigger }),
      // Comparar com o valor atual em vez de olhar só o corpo: trocar para um
      // gatilho que não aceita formulário tem que limpar os `formIds` antigos, e
      // esse patch não menciona `formIds`. Deixar a junção suja bagunçaria a
      // trava de duplicata (agora só trigger + template, mas ainda incoerente).
      ...(this.formIdsChanged(formIds, existing.formIds) && { formIds }),
      ...(input.delayMinutes !== undefined && { delayMinutes: input.delayMinutes || null }),
      ...(input.cron !== undefined && { cron: input.cron }),
      ...(input.timezone !== undefined && { timezone: input.timezone }),
      // Remarcar a data (ou trocar de gatilho) reabre o disparo: sem limpar o
      // `firedAt`, uma regra já disparada nunca dispararia na data nova.
      ...(sendAtChanged && { sendAt, firedAt: null }),
      ...(input.active !== undefined && { active: input.active }),
      ...(input.folderId !== undefined && { folderId: input.folderId }),
    });
    await this.syncRecurringScheduler(updated);
    return updated;
  }

  private formIdsChanged(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return true;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.some((id, i) => id !== sortedB[i]);
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
    formIds?: string[],
    sendAt?: Date | null,
  ): void {
    const errors = new AutomationValidator().validate({
      trigger,
      cron,
      timezone,
      formIds,
      sendAt,
    });
    if (errors.length > 0) throw new BadRequestException(errors[0]);
  }

  /** Fuso em que a regra agendada foi marcada; só `recurring` e `on_date` guardam. */
  private resolveTimezone(trigger: string, timezone?: string | null): string | null {
    if (AutomationRuleEntity.isRecurring(trigger)) return timezone ?? null;
    if (AutomationRuleEntity.isDate(trigger)) return timezone?.trim() || APP_TIMEZONE;
    return null;
  }

  /**
   * ISO local + fuso da regra → instante UTC. Sem fuso, assume o da aplicação
   * (America/Sao_Paulo), que é onde o painel opera. Data no passado é 400: a
   * regra nunca dispararia e o sweeper a mandaria na próxima varredura.
   */
  private resolveSendAt(
    trigger: string,
    sendAt?: string | null,
    timezone?: string | null,
  ): Date | null {
    if (!AutomationRuleEntity.isDate(trigger) || !sendAt) return null;
    const zone = timezone?.trim() || APP_TIMEZONE;
    const parsed = DateTime.fromISO(sendAt, { zone });
    if (!parsed.isValid) throw new BadRequestException('sendAt não é uma data ISO válida');
    return parsed.toUTC().toJSDate();
  }

  /**
   * Data no passado só passa em regra que **já disparou** (`firedAt`) ou que fica
   * **inativa**. Sem isso, ativar uma regra `on_date` vencida — reativar uma
   * antiga, ou ativar a que veio de uma duplicação de evento — faria a varredura
   * seguinte mandar tudo "atrasado". Regra já disparada precisa continuar
   * editável (mover de pasta, renomear), por isso o `firedAt` libera.
   */
  private assertSendAtFuture(
    trigger: string,
    sendAt: Date | null,
    willBeActive: boolean,
    firedAt: Date | null,
  ): void {
    if (!AutomationRuleEntity.isDate(trigger) || !sendAt || !willBeActive || firedAt) return;
    if (sendAt.getTime() <= Date.now()) {
      throw new BadRequestException('sendAt precisa ser no futuro');
    }
  }

  /** Cada formulário do gatilho tem que ser do próprio evento. */
  private async assertFormsBelongToEvent(formIds: string[], eventId: string): Promise<void> {
    for (const formId of formIds) {
      const form = await this.forms.findByIdAndEvent(formId, eventId);
      if (!form) throw new NotFoundException('Form not found');
    }
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

  /**
   * Em `on_date` a chave da duplicata inclui a **data**: o mesmo template em
   * datas diferentes são mensagens diferentes, e o `dedupKey` do outbox carrega o
   * `sendAt`, então não há colisão. Nos outros gatilhos a chave segue sendo
   * (evento, gatilho, template). Espelha os índices parciais do banco.
   */
  private async assertNoActiveDuplicate(
    eventId: string,
    trigger: string,
    templateId: string,
    sendAt?: Date | null,
    excludeId?: string,
  ): Promise<void> {
    const scopedByDate = AutomationRuleEntity.isDate(trigger);
    const duplicate = await this.repo.findActiveByEventTriggerAndTemplate(
      eventId,
      trigger,
      templateId,
      excludeId,
      scopedByDate ? (sendAt ?? null) : undefined,
    );
    if (duplicate) {
      throw new ConflictException(
        scopedByDate
          ? 'An active automation with this template already exists for this date on this event'
          : `An active automation for trigger '${trigger}' with this template already exists on this event`,
      );
    }
  }
}
