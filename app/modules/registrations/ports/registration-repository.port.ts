import { RegistrationEntity, FunnelStatus } from '../entities/registration.entity';

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
  ): Promise<RegistrationEntity[]>;
  findAllByEventPaginated(
    eventId: string,
    pagination: { skip: number; take: number },
    status?: FunnelStatus,
    search?: string,
  ): Promise<{ data: RegistrationEntity[]; total: number }>;
  create(data: CreateRegistrationData): Promise<RegistrationEntity>;
  updateStatus(id: string, status: FunnelStatus): Promise<RegistrationEntity>;
  updateAnswers(id: string, data: UpdateAnswersData): Promise<RegistrationEntity>;
  findByEventAndContact(
    eventId: string,
    contact: { email?: string; phone?: string },
  ): Promise<RegistrationEntity | null>;
  upsertPostEventResponse(data: PostEventResponseData): Promise<void>;
  countByEvent(eventId: string): Promise<number>;
}
