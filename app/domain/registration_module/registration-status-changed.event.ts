import { DomainEvent } from '@handlers/domain-event';
import { FunnelStatus } from './registration.entity';

export class RegistrationStatusChanged extends DomainEvent {
  get eventName(): string {
    return 'registration.status_changed';
  }

  constructor(
    public readonly registrationId: string,
    public readonly eventId: string,
    public readonly previousStatus: FunnelStatus,
    public readonly newStatus: FunnelStatus,
    public readonly ownerId: string,
    /** Formulário que criou a inscrição, quando ela nasceu de uma submissão. */
    public readonly formId: string | null = null,
  ) {
    super();
  }
}
