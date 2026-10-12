import { EntityBase } from '@domain/shared/entity.base';

/** Gatilhos aceitos, espelhando o enum `AutomationTrigger` do banco. */
export const AUTOMATION_TRIGGERS = [
  'on_registration',
  'on_approval',
  'on_rejection',
  'recurring',
  'on_form_submitted',
  'on_date',
  'on_date_form_field',
  'on_event_delay',
] as const;

export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export const AUTOMATION_DELAY_DIRECTIONS = ['before', 'after'] as const;
export const AUTOMATION_DELAY_UNITS = ['minutes', 'hours', 'days'] as const;

export type AutomationDelayDirection = (typeof AUTOMATION_DELAY_DIRECTIONS)[number];
export type AutomationDelayUnit = (typeof AUTOMATION_DELAY_UNITS)[number];

/** Teto do delay de `on_event_delay`: 365 dias, em minutos (dia = 24h exatas). */
export const MAX_EVENT_DELAY_MINUTES = 365 * 24 * 60;

const MINUTES_PER_UNIT: Record<AutomationDelayUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
};

export function delayToMinutes(value: number, unit: AutomationDelayUnit): number {
  return value * MINUTES_PER_UNIT[unit];
}

/** Hora do disparo mensal de `on_date_form_field` quando a regra não define `sendTime`. */
export const DEFAULT_SEND_TIME = '09:00';

/**
 * Regra que dispara uma mensagem a partir de um acontecimento do evento.
 *
 * `recurring`, `on_date`, `on_date_form_field` e `on_event_delay` são os gatilhos fora da curva:
 * em vez de reagir a um acontecimento, rodam por agenda. `recurring` repete por
 * cron (exige `cron` + `timezone`); `on_date` dispara uma vez só, no instante de
 * `sendAt`; `on_date_form_field` dispara todo mês, por inscrito, no dia-do-mês
 * que a pessoa respondeu num campo `on_date_automation_field` — hora vem de
 * `sendTime` (default `09:00`) no `timezone` da regra; `on_event_delay` dispara
 * uma vez, X tempo antes (`eventDate`) ou depois (`endDate ?? eventDate`) do
 * evento, acompanhando a data atual dele.
 *
 * Qualquer gatilho aceita mais de uma regra ativa no mesmo evento, desde que
 * usem templates diferentes (ex: aprovação mandando e-mail e WhatsApp). Repetir
 * o mesmo template no mesmo gatilho é recusado com 409 — as duas linhas
 * colidiriam no `dedupKey` do outbox e a segunda nunca sairia.
 *
 * Campos públicos com o nome das colunas: as listagens são serializadas direto
 * como corpo da resposta.
 */
export class AutomationRuleEntity extends EntityBase {
  constructor(
    id: string,
    public readonly eventId: string,
    public readonly templateId: string,
    public readonly trigger: AutomationTrigger,
    /**
     * Formulários que disparam a regra. Vazio = todos os formulários do evento,
     * dinamicamente (formulário criado depois já dispara). Os 8 gatilhos aceitam
     * `formIds`; obrigatório e não-vazio em `on_form_submitted` e `on_date_form_field`
     * (`requiresForm`).
     */
    public readonly formIds: string[],
    public readonly delayMinutes: number | null,
    public readonly cron: string | null,
    public readonly timezone: string | null,
    public readonly active: boolean,
    /** Pasta que organiza a regra. Sempre uma pasta do mesmo evento. */
    public readonly folderId: string | null,
    /** Posição manual dentro da pasta (ou da raiz). */
    public readonly order: number,
    public readonly createdAt: Date,
    /** Instante do disparo único de `on_date`, em UTC. */
    public readonly sendAt: Date | null = null,
    /** Preenchido no claim do sweeper: regra já disparada não dispara de novo. */
    public readonly firedAt: Date | null = null,
    /** Hora do disparo mensal de `on_date_form_field`, "HH:mm". Só esse gatilho usa. */
    public readonly sendTime: string | null = null,
    /** Nome próprio da regra. `null` = a UI cai no nome do template. */
    public readonly name: string | null = null,
    /** `on_event_delay`: antes ou depois do evento. */
    public readonly delayDirection: AutomationDelayDirection | null = null,
    /** `on_event_delay`: quantidade inteira >= 1, na unidade `delayUnit`. */
    public readonly delayValue: number | null = null,
    public readonly delayUnit: AutomationDelayUnit | null = null,
    /**
     * `on_event_delay`: momento de disparo já processado. O sweeper recalcula o
     * momento a cada tick; se difere deste (evento remarcado, delay editado), a
     * regra rearma sozinha.
     */
    public readonly firedForAt: Date | null = null,
  ) {
    super(id);
  }

  isRecurring(): boolean {
    return AutomationRuleEntity.isRecurring(this.trigger);
  }

  /**
   * `on_form_submitted` e `on_date_form_field` não fazem sentido sem saber QUAL
   * formulário: o primeiro é o próprio evento que dispara a regra; o segundo
   * precisa do formulário pra resolver o campo de data. Os outros 5 gatilhos
   * aceitam `formIds` como escopo opcional (vazio = todos).
   */
  static requiresForm(trigger: string): boolean {
    return trigger === 'on_form_submitted' || trigger === 'on_date_form_field';
  }

  /**
   * Critério de escopo por formulário quando o gatilho não nasce de uma
   * submissão: em vez do formulário que originou a inscrição (`matchesForm`),
   * vale a participação — o inscrito respondeu (tem `FormResponse`) algum dos
   * formulários da regra. `on_registration` e `on_form_submitted` ficam de
   * fora: para eles o formulário da submissão já resolve, no mesmo instante do
   * disparo.
   */
  static scopedByResponse(trigger: string): boolean {
    return (
      trigger === 'on_approval' ||
      trigger === 'on_rejection' ||
      trigger === 'recurring' ||
      trigger === 'on_date' ||
      trigger === 'on_date_form_field' ||
      trigger === 'on_event_delay'
    );
  }

  /** Lista vazia = todos; caso contrário só quem entrou por um dos formulários. */
  static matchesForm(formIds: string[], formId: string | null): boolean {
    return formIds.length === 0 || (formId !== null && formIds.includes(formId));
  }

  static isRecurring(trigger: string): boolean {
    return trigger === 'recurring';
  }

  /** Disparo único numa data marcada na regra, igual para todos os inscritos. */
  static isDate(trigger: string): boolean {
    return trigger === 'on_date';
  }

  /** Disparo único X tempo antes/depois do evento, recalculado pela data atual dele. */
  static isEventDelay(trigger: string): boolean {
    return trigger === 'on_event_delay';
  }

  /**
   * Data de referência do delay: `before` conta do início (`eventDate`); `after`
   * conta do fim (`endDate`, ou `eventDate` se o evento não tem fim). Sem
   * `eventDate` não há referência.
   */
  static eventDelayReference(
    event: { eventDate: Date | null; endDate: Date | null },
    direction: AutomationDelayDirection,
  ): Date | null {
    if (!event.eventDate) return null;
    return direction === 'after' ? (event.endDate ?? event.eventDate) : event.eventDate;
  }

  /** Momento exato do disparo: referência ± delay. `null` se o evento não tem data. */
  static computeEventDelayFireAt(
    event: { eventDate: Date | null; endDate: Date | null },
    delay: { direction: AutomationDelayDirection; value: number; unit: AutomationDelayUnit },
  ): Date | null {
    const reference = AutomationRuleEntity.eventDelayReference(event, delay.direction);
    if (!reference) return null;
    const offset = delayToMinutes(delay.value, delay.unit) * 60_000;
    return new Date(reference.getTime() + (delay.direction === 'before' ? -offset : offset));
  }

  /** Recorrência mensal por inscrito, calculada a partir do formulário — sem agenda materializada. */
  static isDateFormField(trigger: string): boolean {
    return trigger === 'on_date_form_field';
  }

  /**
   * Envio imediato é o que não tem espera. Regras gravadas com 0 existem e
   * significam o mesmo que null — daí os dois contarem como imediato.
   */
  isImmediate(): boolean {
    return this.delayMinutes === null || this.delayMinutes === 0;
  }

  /** Um gatilho de data sem data nunca dispararia. */
  static requiresSendAt(trigger: string, sendAt?: Date | null): boolean {
    return AutomationRuleEntity.isDate(trigger) && !sendAt;
  }

  /** Um gatilho recorrente sem agenda nunca dispararia. */
  static requiresSchedule(
    trigger: string,
    cron?: string | null,
    timezone?: string | null,
  ): boolean {
    return AutomationRuleEntity.isRecurring(trigger) && (!cron?.trim() || !timezone?.trim());
  }
}
