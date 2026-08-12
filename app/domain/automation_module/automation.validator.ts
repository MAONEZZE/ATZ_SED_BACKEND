import { ValidatorBase } from '@domain/shared/validator.base';
import { AutomationRuleEntity } from './automation-rule.entity';

export interface AutomationScheduleInput {
  trigger: string;
  cron?: string | null;
  timezone?: string | null;
}

/**
 * Invariantes de uma regra de automação. O gatilho duplicado ativo não entra
 * aqui: precisa consultar as outras regras do evento, então fica no service.
 */
export class AutomationValidator extends ValidatorBase<AutomationScheduleInput> {
  validate(input: AutomationScheduleInput): string[] {
    const errors: string[] = [];

    // Só `recurring` roda por agenda; os outros gatilhos reagem a um
    // acontecimento e não têm cron nem fuso.
    if (AutomationRuleEntity.isRecurring(input.trigger)) {
      if (!input.cron) errors.push('cron é obrigatório para trigger "recurring"');
      if (!input.timezone) errors.push('timezone é obrigatório para trigger "recurring"');
    }

    return errors;
  }
}
