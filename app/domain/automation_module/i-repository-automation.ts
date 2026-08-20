import { MessageChannel } from '@domain/shared/message-channel.type';
import { EventDuplicationAutomationRule } from '@domain/event_module/i-repository-event';
import { MessageTemplateEntity } from '@domain/message_template_module/message-template.entity';
import { AutomationRuleEntity, AutomationTrigger } from './automation-rule.entity';

export const AUTOMATION_REPOSITORY_PORT = Symbol('AUTOMATION_REPOSITORY_PORT');

export interface CreateAutomationRuleData {
  eventId: string;
  templateId: string;
  /** Obrigatório (não-vazio) no gatilho on_form_submitted; ignorado nos outros. */
  formIds?: string[];
  trigger: AutomationTrigger;
  delayMinutes?: number | null;
  cron?: string | null;
  timezone?: string | null;
  active?: boolean;
  folderId?: string | null;
}

/** Chave ausente deixa a coluna/relação intacta; `formIds` presente substitui a junção inteira. */
export interface UpdateAutomationRuleData {
  templateId?: string;
  formIds?: string[];
  trigger?: AutomationTrigger;
  delayMinutes?: number | null;
  cron?: string | null;
  timezone?: string | null;
  active?: boolean;
  folderId?: string | null;
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
  /**
   * `folderId` tem três casos: `undefined` = todas as regras do evento, `null` =
   * só as que estão fora de pasta, string = só as daquela pasta.
   */
  findAllByEventPaginated(
    eventId: string,
    pagination: { skip: number; take: number },
    folderId?: string | null,
  ): Promise<{ data: AutomationRuleWithTemplate[]; total: number }>;

  /** Lista cross-evento: ordena por data, porque `order` manual só faz sentido dentro do evento. */
  findAllForUserPaginated(
    userId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ data: AutomationRuleWithEventAndTemplate[]; total: number }>;

  findAllRecurringActive(): Promise<RecurringSchedule[]>;

  findById(id: string): Promise<AutomationRuleEntity | null>;

  /** Resolve pelo evento, para não alcançar regra de outro evento. */
  findByEvent(eventId: string, id: string): Promise<AutomationRuleEntity | null>;

  findOneWithTemplate(eventId: string, id: string): Promise<AutomationRuleWithFullTemplate | null>;

  /**
   * Barra a única duplicata que não funciona: mesma regra (gatilho + template)
   * ativa duas vezes no mesmo evento. O `dedupKey` do outbox carrega
   * `templateId`, então as duas linhas colidiriam no @unique e a segunda nunca
   * sairia. Gatilho repetido com templates **diferentes** é liberado — é o caso
   * de mandar a mesma etapa por e-mail e por WhatsApp. `formIds` não entra na
   * chave: o mesmo template em formulários diferentes é UMA regra com dois
   * formIds, não duas regras.
   */
  findActiveByEventTriggerAndTemplate(
    eventId: string,
    trigger: string,
    templateId: string,
    excludeId?: string,
  ): Promise<AutomationRuleEntity | null>;

  /** O template referenciado existe e é alcançável pelo evento (dele ou global)? */
  templateById(templateId: string, eventId?: string): Promise<MessageTemplateEntity | null>;

  create(data: CreateAutomationRuleData): Promise<AutomationRuleWithTemplate>;
  update(id: string, data: UpdateAutomationRuleData): Promise<AutomationRuleWithTemplate>;
  delete(id: string): Promise<void>;

  /**
   * Reescreve `order` na ordem dos ids, numa transação, dentro da pasta dada
   * (`null` = fora de pasta). O evento entra no `where` como guarda.
   */
  reorder(eventId: string, folderId: string | null, ids: string[]): Promise<void>;
  /**
   * Move a regra para antes de `beforeId` (ausente = fim) na pasta em que ela já
   * está. `false` = regra ou âncora fora do evento/pasta.
   */
  move(eventId: string, id: string, beforeId?: string): Promise<boolean>;

  /**
   * Regras ativas de um evento+gatilho. `ruleIds` filtra pelo conjunto exato
   * (usado pelo worker de recorrência); sem ele, só as de disparo imediato.
   */
  findActiveTriggerRules(
    eventId: string,
    trigger: string,
    ruleIds?: string[],
  ): Promise<AutomationRuleWithFullTemplate[]>;

  /**
   * `formIds` já vem resolvido pelo application layer (slug -> id do formulário
   * recém-criado no evento novo); o repositório só grava.
   */
  createManyForDuplication(
    eventId: string,
    rules: Array<Omit<EventDuplicationAutomationRule, 'formSlugs'> & { formIds: string[] }>,
  ): Promise<{ count: number }>;
}
