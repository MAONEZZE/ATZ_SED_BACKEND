import { DomainEvent } from '@domain/shared/domain-event';

export type FormSubmittedTrigger = 'on_post_event' | 'on_nps';

export class FormSubmitted extends DomainEvent {
  get eventName(): string {
    return 'form.submitted';
  }

  constructor(
    public readonly eventId: string,
    public readonly trigger: FormSubmittedTrigger,
    public readonly contact: { name: string; email: string; phone: string },
  ) {
    super();
  }
}
