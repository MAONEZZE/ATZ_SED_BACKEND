import { MessageChannel } from '@domain/shared/message-channel.type';
import { EventDuplicationAutomationRule } from '@domain/event_module/i-repository-event';
import { MessageTemplateEntity } from '@domain/message_template_module/message-template.entity';
import { AutomationRuleEntity, AutomationTrigger } from './automation-rule.entity';

export const AUTOMATION_REPOSITORY_PORT = Symbol('AUTOMATION_REPOSITORY_PORT');

export interface CreateAutomationRuleData {
  eventId: string;
  templateId: string;
  trigger: AutomationTrigger;
  delayMinutes?: number | null;
  cron?: string | null;
  timezone?: string | null;
  active?: boolean;
}

/** Chave ausente deixa a coluna intacta. */
export interface UpdateAutomationRuleData {
  templateId?: string;
  trigger?: AutomationTrigger;
  delayMinutes?: number | null;
  cron?: string | null;
  timezone?: string | null;
  active?: boolean;
}

/** Resumo do template exibido junto da regra nas telas de listagem. */
export interface TemplateSummary {
  id: string;
  name: string;
  channel: MessageChannel;
}

/** Regra com o resumo do template anexado; serializada direto na resposta. */
export type AutomationRuleWithTemplate = AutomationRuleEntity & {
  template: TemplateSummary;
};

/** Listagem global: também traz o evento, para a tela exibir o título. */
export type AutomationRuleWithEventAndTemplate = AutomationRuleWithTemplate & {
  event: { id: string; title: string };
};

/** Regra com o template inteiro — o motor precisa do corpo para renderizar. */
export type AutomationRuleWithFullTemplate = AutomationRuleEntity & {
  template: MessageTemplateEntity;
};

/** Só o necessário para (re)agendar: o scheduler não lê corpo de mensagem. */
export interface RecurringSchedule {
  id: string;
  cron: string | null;
  timezone: string | null;
}

export interface AutomationRepositoryPort {
  findAllByEventPaginated(
    eventId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ data: AutomationRuleWithTemplate[]; total: number }>;

  findAllForUserPaginated(
    userId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ data: AutomationRuleWithEventAndTemplate[]; total: number }>;

  findAllRecurringActive(): Promise<RecurringSchedule[]>;

  findById(id: string): Promise<AutomationRuleEntity | null>;

  /** Resolve pelo evento, para não alcançar regra de outro evento. */
  findByEvent(eventId: string, id: string): Promise<AutomationRuleEntity | null>;

  findOneWithTemplate(eventId: string, id: string): Promise<AutomationRuleWithFullTemplate | null>;

  /** Usado para barrar um segundo gatilho ativo igual no mesmo evento. */
  findActiveByEventAndTrigger(
    eventId: string,
    trigger: string,
    excludeId?: string,
  ): Promise<AutomationRuleEntity | null>;

  /** O template referenciado existe? Não devolve a regra, só valida o vínculo. */
  templateById(templateId: string): Promise<MessageTemplateEntity | null>;

  create(data: CreateAutomationRuleData): Promise<AutomationRuleWithTemplate>;
  update(id: string, data: UpdateAutomationRuleData): Promise<AutomationRuleWithTemplate>;
  delete(id: string): Promise<void>;

  /**
   * Regras ativas de um evento+gatilho. `ruleIds` filtra pelo conjunto exato
   * (usado pelo worker de recorrência); sem ele, só as de disparo imediato.
   */
  findActiveTriggerRules(
    eventId: string,
    trigger: string,
    ruleIds?: string[],
  ): Promise<AutomationRuleWithFullTemplate[]>;

  createManyForDuplication(
    eventId: string,
    rules: EventDuplicationAutomationRule[],
  ): Promise<{ count: number }>;
}
