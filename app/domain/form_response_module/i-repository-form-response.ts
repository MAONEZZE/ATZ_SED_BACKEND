import { FormResponseEntity } from './form-response.entity';
import { PipedriveStatus } from '@domain/registration_module/registration.entity';

export const FORM_RESPONSE_REPOSITORY_PORT = Symbol('FORM_RESPONSE_REPOSITORY_PORT');

export interface UpsertFormResponseData {
  formId: string;
  eventId: string;
  registrationId: string;
  answers: Record<string, unknown>;
}

/** Linha da listagem/CSV: a resposta com o inscrito e o formulário que a originou. */
export interface FormResponseWithContext {
  id: string;
  formId: string;
  formName: string;
  registrationId: string;
  name: string;
  email: string;
  phone: string;
  answers: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormResponseRepositoryPort {
  /** Idempotente por `(formId, registrationId)`: reenviar sobrescreve as respostas. */
  upsert(data: UpsertFormResponseData): Promise<FormResponseEntity>;
  findAllByEvent(eventId: string, formId?: string): Promise<FormResponseWithContext[]>;
  findAllByEventPaginated(
    eventId: string,
    pagination: { skip: number; take: number },
    formId?: string,
  ): Promise<{ data: FormResponseWithContext[]; total: number }>;
  /** Resultado do envio ao Pipedrive por resposta (antes vivia em Registration). */
  setPipedriveStatus(id: string, status: PipedriveStatus): Promise<void>;
}
