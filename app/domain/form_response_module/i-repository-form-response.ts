import { FormResponseEntity } from './form-response.entity';
import {
  FunnelStatus,
  PipedriveStatus,
} from '@domain/registration_module/registration.entity';

export const FORM_RESPONSE_REPOSITORY_PORT = Symbol('FORM_RESPONSE_REPOSITORY_PORT');

export interface UpsertFormResponseData {
  formId: string;
  eventId: string;
  /** Null em resposta anônima: sem inscrito, sem upsert (vira create). */
  registrationId: string | null;
  answers: Record<string, unknown>;
}

/** Linha da listagem/CSV: a resposta com o inscrito e o formulário que a originou. */
export interface FormResponseWithContext {
  id: string;
  formId: string;
  formName: string;
  registrationId: string | null;
  name: string;
  email: string;
  phone: string;
  /** Null em resposta anônima: sem inscrito, sem status de funil. */
  status: FunnelStatus | null;
  answers: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormResponseRepositoryPort {
  /** Idempotente por `(formId, registrationId)` quando há inscrito; resposta anônima (registrationId null) sempre cria linha nova. */
  upsert(data: UpsertFormResponseData): Promise<FormResponseEntity>;
  findAllByEvent(eventId: string, formId?: string): Promise<FormResponseWithContext[]>;
  findAllByEventPaginated(
    eventId: string,
    pagination: { skip: number; take: number },
    formId?: string,
  ): Promise<{ data: FormResponseWithContext[]; total: number }>;
  /** Resultado do envio ao Pipedrive por resposta (antes vivia em Registration). */
  setPipedriveStatus(id: string, status: PipedriveStatus): Promise<void>;

  /**
   * Página de respostas de inscritos `approved` a um formulário — usada pelo
   * sweeper de `on_date_form_field`. INNER JOIN com `registration` (não LEFT):
   * resolve de graça o caso de `registrationId` nullable (formulário anônimo).
   */
  findApprovedByForm(
    formId: string,
    pagination: { skip: number; take: number },
  ): Promise<Array<{ registrationId: string; answers: Record<string, unknown> }>>;

  /**
   * Merge raso (jsonb ||) das chaves editadas dentro do FormResponse existente.
   * No-op se a linha não existir (inscrito nunca respondeu esse formulário) —
   * não cria uma resposta vazia. Usado pelo painel: mantém FormResponse.answers
   * em sincronia com Registration.answers pros campos que a automação lê.
   */
  mergeAnswers(
    formId: string,
    registrationId: string,
    partialAnswers: Record<string, unknown>,
  ): Promise<void>;
}
