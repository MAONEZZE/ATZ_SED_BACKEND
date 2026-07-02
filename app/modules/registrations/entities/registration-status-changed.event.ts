import { DomainEvent } from '@shared/domain-event';
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
  ) {
    super();
  }
}
