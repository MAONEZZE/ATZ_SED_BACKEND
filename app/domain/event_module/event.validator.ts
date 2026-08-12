import { ValidatorBase } from '@domain/shared/validator.base';
import { EventEntity, EventStatus } from './event.entity';

export interface EventPeriodInput {
  eventDate?: Date | null;
  endDate?: Date | null;
}

/**
 * Invariantes de um evento. Capacidade e propriedade não entram aqui: dependem
 * de consulta ao banco e ficam no service.
 */
export class EventValidator extends ValidatorBase<EventPeriodInput> {
  validate(input: EventPeriodInput): string[] {
    const errors: string[] = [];

    // Um evento que termina antes de começar não é agendável. Fim igual ao
    // início também não vale — seria duração zero.
    if (input.eventDate && input.endDate && input.endDate.getTime() <= input.eventDate.getTime()) {
      errors.push('endDate must be after eventDate');
    }

    return errors;
  }

  /** Transição de status permitida pela máquina de estados da entidade. */
  static validateTransition(event: EventEntity, next: EventStatus): string[] {
    if (!event.canTransitionTo(next)) {
      return [`Cannot transition from '${event.status}' to '${next}'`];
    }
    return [];
  }
}
