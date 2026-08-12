import { FormKind } from '@domain/shared/form-kind.type';
import { EventDuplicationForm } from '@domain/event_module/i-repository-event';
import { FormEntity } from './form.entity';

export const FORM_REPOSITORY_PORT = Symbol('FORM_REPOSITORY_PORT');

/** Fields a caller may change on an existing form. Every key is optional: an
 * absent key leaves the column untouched. */
export interface UpdateFormData {
  description?: string;
  postRegistrationMessage?: string;
  linkPostSubscription?: string;
  requireImageAuthorization?: boolean;
}

export interface FormRepositoryPort {
  findByEventAndKind(eventId: string, kind: FormKind): Promise<FormEntity | null>;
  create(eventId: string, kind: FormKind): Promise<FormEntity>;
  update(id: string, data: UpdateFormData): Promise<FormEntity>;
  /** Clones a form together with its fields onto another event (event duplication). */
  createWithFields(eventId: string, form: EventDuplicationForm): Promise<FormEntity>;
}
