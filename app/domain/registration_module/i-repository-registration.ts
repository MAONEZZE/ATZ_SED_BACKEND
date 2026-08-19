import { RegistrationEntity, FunnelStatus, PipedriveStatus } from './registration.entity';

export const REGISTRATION_REPOSITORY_PORT = Symbol('REGISTRATION_REPOSITORY_PORT');

export interface CreateRegistrationData {
  eventId: string;
  answers: Record<string, unknown>;
  name: string;
  email: string;
  phone: string;
  imageAuthorization?: boolean;
  /** Formulário que criou a inscrição. Ausente/null = origem desconhecida (import sem form, painel). */
  originFormId?: string | null;
}

export interface UpdateAnswersData {
  answers: Record<string, unknown>;
  name?: string;
  email?: string;
  phone?: string;
}

/** Candidata do check-in público: a inscrição e a data do evento dela. */
export interface RegistrationWithEventDate {
  id: string;
  phone: string;
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  eventDate: Date;
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
  /**
   * Check-in público sem evento no caminho: busca por telefone em todos os
   * eventos, já com a data do evento para escolher o mais próximo de hoje.
   * `phoneSuffix` são os 8 dígitos finais (pré-filtro grosso; o casamento fino é
   * por `phoneMatchKey`). Evento sem data fica fora — não há como medir distância.
   */
  findByPhoneWithEventDate(phoneSuffix: string): Promise<RegistrationWithEventDate[]>;
  /** Resultado do envio ao Pipedrive por inscrito (antes vivia em user_subscriptions). */
  setPipedriveStatus(id: string, status: PipedriveStatus): Promise<void>;
  countByEvent(eventId: string): Promise<number>;
  /** Registrations still in the funnel (approved/pending) — used for cancellation notices. */
  findActiveByEvent(eventId: string): Promise<RegistrationEntity[]>;
  findByIdsAndEvent(ids: string[], eventId: string): Promise<RegistrationEntity[]>;
}
