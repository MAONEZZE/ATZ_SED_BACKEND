import { EventDuplicationForm } from '@domain/event_module/i-repository-event';
import { FormEntity } from './form.entity';

export const FORM_REPOSITORY_PORT = Symbol('FORM_REPOSITORY_PORT');

export interface CreateFormData {
  eventId: string;
  name: string;
  slug: string;
  description?: string | null;
  postRegistrationMessage?: string | null;
  linkPostSubscription?: string | null;
  requireImageAuthorization?: boolean;
  sendToPipedrive?: boolean;
}

/** Chave ausente deixa a coluna intacta. */
export interface UpdateFormData {
  name?: string;
  slug?: string;
  description?: string;
  postRegistrationMessage?: string;
  linkPostSubscription?: string;
  requireImageAuthorization?: boolean;
  sendToPipedrive?: boolean;
}

export interface FormRepositoryPort {
  /** Formulários do evento, ordenados por `order` e depois `createdAt`. */
  listByEvent(eventId: string): Promise<FormEntity[]>;
  /** O eventId entra na consulta: sem ele um id conhecido devolveria form de outro evento. */
  findByIdAndEvent(id: string, eventId: string): Promise<FormEntity | null>;
  findByEventAndSlug(eventId: string, slug: string): Promise<FormEntity | null>;
  /** Resolve o formulário pela URL pública (slug do evento + slug do form). */
  findByEventSlugAndFormSlug(eventSlug: string, formSlug: string): Promise<FormEntity | null>;
  /** `order` nasce no fim da lista do evento (max + 1). */
  create(data: CreateFormData): Promise<FormEntity>;
  update(id: string, data: UpdateFormData): Promise<FormEntity>;
  /** Leva os campos e as respostas por cascata do banco. */
  delete(id: string): Promise<void>;
  /** Reescreve `order` na ordem dos ids, dentro do evento. */
  reorder(eventId: string, ids: string[]): Promise<void>;
  /** Clona um formulário com os campos para outro evento (duplicação de evento). */
  createWithFields(eventId: string, form: EventDuplicationForm): Promise<FormEntity>;
}
