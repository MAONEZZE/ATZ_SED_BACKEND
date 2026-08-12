import { PostEventResponseEntity } from './post-event-response.entity';

export const POST_EVENT_RESPONSE_REPOSITORY_PORT = Symbol('POST_EVENT_RESPONSE_REPOSITORY_PORT');

/** Contato de quem respondeu, resolvido pela inscrição associada. */
export interface PostEventRespondent {
  name: string;
  email: string;
  phone: string;
}

/**
 * Forma plana devolvida pela listagem paginada. É serializada direto como corpo
 * da resposta HTTP, então os nomes de campo são contrato com o frontend — daí
 * ser um tipo próprio, e não a entidade.
 */
export interface PostEventResponseListItem {
  id: string;
  eventId: string;
  registrationId: string;
  answers: unknown;
  createdAt: Date;
  updatedAt: Date;
  registration: { id: string } & PostEventRespondent;
}

/** Usado só pela exportação CSV, que não trafega para o cliente. */
export interface PostEventResponseWithRespondent {
  response: PostEventResponseEntity;
  respondent: PostEventRespondent;
}

/**
 * Sem `create`/`update`: a escrita acontece em
 * `RegistrationRepositoryPort.upsertPostEventResponse`, junto da inscrição.
 */
export interface PostEventResponseRepositoryPort {
  findAllByEventPaginated(
    eventId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ data: PostEventResponseListItem[]; total: number }>;

  findAllByEvent(eventId: string): Promise<PostEventResponseWithRespondent[]>;
}
