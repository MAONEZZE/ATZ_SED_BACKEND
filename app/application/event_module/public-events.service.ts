import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  EVENT_REPOSITORY_PORT,
  EventRepositoryPort,
} from '@domain/event_module/i-repository-event';
import { FormsRepository } from '@infra/repositories/form_module/forms.repository';
import { FormFieldsRepository } from '@infra/repositories/form_field_module/form-fields.repository';
import { FormKind } from '@domain/shared/form-kind.type';

/**
 * Read-only queries backing the public (unauthenticated) event pages.
 * Centralizes the "is this event visible?" gating that was copy-pasted across
 * the public controllers.
 */
@Injectable()
export class PublicEventsService {
  constructor(
    @Inject(EVENT_REPOSITORY_PORT) private readonly eventRepo: EventRepositoryPort,
    private readonly forms: FormsRepository,
    private readonly formFields: FormFieldsRepository,
  ) {}

  async getPublicEvent(slug: string) {
    const event = await this.eventRepo.findPublicBySlug(slug);
    if (!event || (event.status !== 'published' && event.status !== 'ended')) {
      throw new NotFoundException('Event not found');
    }

    // description/postRegistrationMessage now live on the registration Form
    // scope, not on Event — merge them into the public payload so the
    // public page doesn't need a second round-trip.
    const form = await this.forms.findByEventAndKind(event.id, 'registration');

    return {
      ...event,
      description: form?.description ?? null,
      postRegistrationMessage: form?.postRegistrationMessage ?? null,
      linkPostSubscription: form?.linkPostSubscription ?? null,
      requireImageAuthorization: form?.requireImageAuthorization ?? false,
    };
  }

  /**
   * Returns the form fields of a given kind for a public event.
   * Registration fields are visible only while `published`; post-event/NPS
   * fields (`allowEnded`) stay visible after the event has `ended`.
   */
  async getPublicFormFields(slug: string, kind: FormKind, allowEnded: boolean) {
    const event = await this.eventRepo.findStatusBySlug(slug);
    const visible =
      !!event && (event.status === 'published' || (allowEnded && event.status === 'ended'));
    if (!visible) throw new NotFoundException('Event not found');

    return this.formFields.listPublicByEventAndKind(event!.id, kind);
  }

  /** Fields used to validate a public registration/post-event/NPS submission. */
  getSubmissionFields(slug: string, kind: FormKind) {
    return this.formFields.listValidationFieldsBySlug(slug, kind);
  }
}
