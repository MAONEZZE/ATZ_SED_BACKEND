import { DomainEvent } from '@handlers/domain-event';

/**
 * Um formulário do evento foi respondido. Carrega o `formId` porque as
 * automações do gatilho `on_form_submitted` são escopadas por formulário — os
 * antigos `on_post_event`/`on_nps` morreram com os 3 tipos fixos (2026-08-17).
 */
export class FormSubmitted extends DomainEvent {
  get eventName(): string {
    return 'form.submitted';
  }

  constructor(
    public readonly eventId: string,
    public readonly formId: string,
    public readonly contact: { name: string; email: string; phone: string },
  ) {
    super();
  }
}
