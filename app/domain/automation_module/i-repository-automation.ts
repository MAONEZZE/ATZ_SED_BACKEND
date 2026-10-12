import { MessageChannel } from '@domain/shared/message-channel.type';
import { MessageTemplateEntity } from '@domain/message_template_module/message-template.entity';
import {
  AutomationDelayDirection,
  AutomationDelayUnit,
  AutomationRuleEntity,
  AutomationTrigger,
} from './automation-rule.entity';

export const AUTOMATION_REPOSITORY_PORT = Symbol('AUTOMATION_REPOSITORY_PORT');

export interface CreateAutomationRuleData {
  eventId: string;
  templateId: string;
  /** Obrigatório (não-vazio) em on_form_submitted e on_date_form_field; opcional nos outros 5. */
  formIds?: string[];
  trigger: AutomationTrigger;
  delayMinutes?: number | null;
  cron?: string | null;
  timezone?: string | null;
  /** Instante do disparo único de `on_date`, em UTC. */
  sendAt?: Date | null;
  /** Hora do disparo mensal de `on_date_form_field`, "HH:mm". */
  sendTime?: string | null;
  /** Nome próprio da regra. `null`/ausente = a UI cai no nome do template. */
  name?: string | null;
  /** `on_event_delay`: antes/depois, quantidade e unidade. `null`/ausente nos outros gatilhos. */
  delayDirection?: AutomationDelayDirection | null;
  delayValue?: number | null;
  delayUnit?: AutomationDelayUnit | null;
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
  sendAt?: Date | null;
  /** Trocar a data reabre o disparo: o service manda `null` para limpar. */
  firedAt?: Date | null;
  sendTime?: string | null;
  name?: string | null;
  delayDirection?: AutomationDelayDirection | null;
  delayValue?: number | null;
  delayUnit?: AutomationDelayUnit | null;
  /** Momento de disparo de `on_event_delay` já processado; `null` reabre. */
  firedForAt?: Date | null;
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

/** Só o necessário para o sweeper mensal decidir a janela — sem template, sem corpo. */
export interface FormFieldDateRule {
  id: string;
  eventId: string;
  sendTime: string | null;
  timezone: string | null;
  /** Vazio = regra legada sem formulário vinculado; o sweeper loga e não dispara. */
  formIds: string[];
}

/** Regra `on_event_delay` ativa + a data atual do evento, para o sweeper calcular o momento em memória. */
export interface EventDelayCandidate {
  id: string;
  eventId: string;
  /** Vazio = todos os formulários do evento. */
  formIds: string[];
  delay: { direction: AutomationDelayDirection; value: number; unit: AutomationDelayUnit };
  /** Último momento de disparo processado; `null` = nunca disparou. */
  firedForAt: Date | null;
  event: { eventDate: Date | null; endDate: Date | null };
}

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

  /** Regras `on_date` ativas cuja data já venceu e que ainda não foram marcadas. */
  findDueDateRules(): Promise<
    Array<{ id: string; eventId: string; sendAt: Date; formIds: string[] }>
  >;

  /**
   * Marca a regra como disparada. Chamado **depois** do envio: se o processo
   * morrer no meio da varredura, a regra continua vencida e o tick seguinte
   * retenta — o `dedupKey` do outbox impede mensagem repetida.
   */
  markDateRuleFired(id: string): Promise<void>;

  /**
   * Regras `on_event_delay` ativas de evento `published`/`ended`. É um pré-filtro:
   * o momento exato do disparo é calculado em memória (`computeEventDelayFireAt`).
   * A janela de 367 dias = teto de 365 + folga.
   */
  findEventDelayCandidates(): Promise<EventDelayCandidate[]>;

  /**
   * Registra que o momento `firedForAt` já foi processado. Chamado **depois** do
   * envio, como em `markDateRuleFired`. Evento remarcado ou delay editado gera
   * outro momento e a regra rearma sozinha.
   */
  markEventDelayRuleFired(id: string, firedForAt: Date): Promise<void>;

  /**
   * Regras `on_date_form_field` ativas de evento `published` — a exceção mora
   * aqui, não no `AutomationEngine` (compartilhado, e os outros gatilhos
   * disparam de propósito em evento `ended`). `take` limita o lote por tick.
   */
  findActiveFormFieldDateRules(opts: {
    take: number;
    eventDateCutoff: Date;
  }): Promise<FormFieldDateRule[]>;

  /** Regra ativa que usa este template — barra o delete do template em uso. */
  findActiveRuleByTemplate(
    templateId: string,
  ): Promise<{ id: string; eventId: string; trigger: string } | null>;

  /** Toda regra (ativa ou não) que usa este template — barra trocar o `eventId` do template em uso. */
  hasRuleForTemplate(templateId: string): Promise<boolean>;

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
   * chave em nenhum dos 8 gatilhos: o mesmo template em formulários diferentes
   * é UMA regra com dois formIds, não duas regras.
   */
  findActiveByEventTriggerAndTemplate(
    eventId: string,
    trigger: string,
    templateId: string,
    excludeId?: string,
    /**
     * Só `on_date`: a data entra na chave, porque o mesmo template em datas
     * diferentes são mensagens diferentes (o dedupKey do outbox carrega o
     * `sendAt`). Ausente = chave sem data, como nos outros gatilhos.
     */
    sendAt?: Date | null,
    /**
     * Só `on_event_delay`: a chave é (evento, template, direção, valor,
     * unidade), espelhando o índice `automation_rules_event_template_delay_key`.
     */
    delay?: { direction: AutomationDelayDirection; value: number; unit: AutomationDelayUnit },
  ): Promise<AutomationRuleEntity | null>;

  /** O template referenciado existe e é do próprio evento — automação nunca usa template global ou de outro evento. */
  templateById(templateId: string, eventId: string): Promise<MessageTemplateEntity | null>;

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
}
