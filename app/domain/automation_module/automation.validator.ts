import { ValidatorBase } from '@domain/shared/validator.base';
import {
  AUTOMATION_DELAY_DIRECTIONS,
  AUTOMATION_DELAY_UNITS,
  AutomationDelayDirection,
  AutomationDelayUnit,
  AutomationRuleEntity,
  MAX_EVENT_DELAY_MINUTES,
  delayToMinutes,
} from './automation-rule.entity';

export interface AutomationScheduleInput {
  trigger: string;
  cron?: string | null;
  timezone?: string | null;
  formIds?: string[];
  sendAt?: Date | null;
  delayDirection?: string | null;
  delayValue?: number | null;
  delayUnit?: string | null;
}

/**
 * Invariantes de uma regra de automação. O gatilho duplicado ativo não entra
 * aqui: precisa consultar as outras regras do evento, então fica no service.
 */
export class AutomationValidator extends ValidatorBase<AutomationScheduleInput> {
  /**
   * `enforceFormRequirement` separa a checagem de `formIds` do resto: na
   * criação sempre vale, mas num PATCH que não menciona `formIds` a
   * obrigatoriedade não se aplica (o service decide quando chamar com `true`).
   */
  validate(input: AutomationScheduleInput, enforceFormRequirement = true): string[] {
    const errors: string[] = [];

    // Só `recurring` roda por agenda; os outros gatilhos reagem a um
    // acontecimento e não têm cron nem fuso.
    if (AutomationRuleEntity.isRecurring(input.trigger)) {
      if (!input.cron) errors.push('cron é obrigatório para trigger "recurring"');
      if (!input.timezone) errors.push('timezone é obrigatório para trigger "recurring"');
    }

    // `on_date` é o disparo único: precisa do instante. O fuso não entra aqui —
    // ausente, o service assume o fuso da aplicação.
    if (AutomationRuleEntity.requiresSendAt(input.trigger, input.sendAt)) {
      errors.push('sendAt é obrigatório para trigger "on_date"');
    }

    // `on_event_delay` precisa dos três campos do delay, e o teto só se checa
    // quando valor e unidade são válidos (senão a conta não faz sentido).
    if (AutomationRuleEntity.isEventDelay(input.trigger)) {
      errors.push(...this.validateEventDelay(input));
    }

    // O gatilho por formulário precisa saber QUAIS formulários disparam.
    if (
      enforceFormRequirement &&
      AutomationRuleEntity.requiresForm(input.trigger) &&
      !input.formIds?.length
    ) {
      errors.push(`formIds é obrigatório para trigger "${input.trigger}"`);
    }

    return errors;
  }

  private validateEventDelay(input: AutomationScheduleInput): string[] {
    const errors: string[] = [];
    const { delayDirection, delayValue, delayUnit } = input;
    const missing = (v: unknown) => v === undefined || v === null;

    if (missing(delayDirection)) {
      errors.push('delayDirection é obrigatório para trigger "on_event_delay"');
    } else if (!AUTOMATION_DELAY_DIRECTIONS.includes(delayDirection as AutomationDelayDirection)) {
      errors.push('delayDirection deve ser "before" ou "after"');
    }

    const valueOk = Number.isInteger(delayValue) && (delayValue as number) >= 1;
    if (missing(delayValue)) {
      errors.push('delayValue é obrigatório para trigger "on_event_delay"');
    } else if (!valueOk) {
      errors.push('delayValue deve ser um inteiro ≥ 1');
    }

    const unitOk = AUTOMATION_DELAY_UNITS.includes(delayUnit as AutomationDelayUnit);
    if (missing(delayUnit)) {
      errors.push('delayUnit é obrigatório para trigger "on_event_delay"');
    } else if (!unitOk) {
      errors.push('delayUnit deve ser "minutes", "hours" ou "days"');
    }

    if (
      valueOk &&
      unitOk &&
      delayToMinutes(delayValue as number, delayUnit as AutomationDelayUnit) >
        MAX_EVENT_DELAY_MINUTES
    ) {
      errors.push('delay máximo é de 365 dias');
    }
    return errors;
  }
}
