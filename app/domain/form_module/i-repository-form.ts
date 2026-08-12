import { FormKind } from '@domain/shared/form-kind.type';
import { EventDuplicationForm } from '@domain/event_module/i-repository-event';

export const FORM_REPOSITORY_PORT = Symbol('FORM_REPOSITORY_PORT');

/** A row of `forms` — metadata for one form scope of an event. */
export interface FormRow {
  id: string;
  eventId: string;
  kind: FormKind;
  description: string | null;
  postRegistrationMessage: string | null;
  linkPostSubscription: string | null;
  requireImageAuthorization: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Fields a caller may change on an existing form. Every key is optional: an
 * absent key leaves the column untouched. */
export interface UpdateFormData {
  description?: string;
  postRegistrationMessage?: string;
  linkPostSubscription?: string;
  requireImageAuthorization?: boolean;
}

export interface FormRepositoryPort {
  findByEventAndKind(eventId: string, kind: FormKind): Promise<FormRow | null>;
  create(eventId: string, kind: FormKind): Promise<FormRow>;
  update(id: string, data: UpdateFormData): Promise<FormRow>;
  /** Clones a form together with its fields onto another event (event duplication). */
  createWithFields(eventId: string, form: EventDuplicationForm): Promise<FormRow>;
}
