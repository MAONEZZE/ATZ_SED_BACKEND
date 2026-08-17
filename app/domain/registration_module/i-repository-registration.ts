import { RegistrationEntity, FunnelStatus } from './registration.entity';

export const REGISTRATION_REPOSITORY_PORT = Symbol('REGISTRATION_REPOSITORY_PORT');

export interface CreateRegistrationData {
  eventId: string;
  answers: Record<string, unknown>;
  name: string;
  email: string;
  phone: string;
  imageAuthorization?: boolean;
}

export interface UpdateAnswersData {
  answers: Record<string, unknown>;
  name?: string;
  email?: string;
  phone?: string;
}

export interface PostEventResponseData {
  eventId: string;
  registrationId: string;
  answers: Record<string, unknown>;
}

export interface RegistrationRepositoryPort {
  findById(id: string): Promise<RegistrationEntity | null>;
  findAllByEvent(
    eventId: string,
    status?: FunnelStatus,
    search?: string,
    attended?: boolean,
  ): Promise<RegistrationEntity[]>;
  findAllByEventPaginated(
    eventId: string,
    pagination: { skip: number; take: number },
    status?: FunnelStatus,
    search?: string,
    attended?: boolean,
  ): Promise<{ data: RegistrationEntity[]; total: number }>;
  /** Apaga de vez. Cascateia as mensagens (outbox + logs) e a resposta de pós-evento do inscrito. */
  deleteMany(ids: string[], eventId: string): Promise<number>;
  /** Marca presença em lote. Retorna quantas inscrições do evento foram afetadas. */
  setAttendance(ids: string[], eventId: string, attended: boolean): Promise<number>;
  create(data: CreateRegistrationData): Promise<RegistrationEntity>;
  updateStatus(id: string, status: FunnelStatus): Promise<RegistrationEntity>;
  updateAnswers(id: string, data: UpdateAnswersData): Promise<RegistrationEntity>;
  findByEventAndContact(
    eventId: string,
    contact: { email?: string; phone?: string },
  ): Promise<RegistrationEntity | null>;
  upsertPostEventResponse(data: PostEventResponseData): Promise<void>;
  countByEvent(eventId: string): Promise<number>;
  /** Registrations still in the funnel (approved/pending) — used for cancellation notices. */
  findActiveByEvent(eventId: string): Promise<RegistrationEntity[]>;
  findByIdsAndEvent(ids: string[], eventId: string): Promise<RegistrationEntity[]>;
}
