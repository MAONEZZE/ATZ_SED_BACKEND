import { RegistrationEntity, FunnelStatus } from '../entities/registration.entity';

export const REGISTRATION_REPOSITORY_PORT = Symbol('REGISTRATION_REPOSITORY_PORT');

export interface CreateRegistrationData {
  eventId: string;
  answers: Record<string, unknown>;
  name: string;
  email: string;
  phone: string;
}

export interface RegistrationRepositoryPort {
  findById(id: string): Promise<RegistrationEntity | null>;
  findAllByEvent(eventId: string, status?: FunnelStatus): Promise<RegistrationEntity[]>;
  create(data: CreateRegistrationData): Promise<RegistrationEntity>;
  updateStatus(id: string, status: FunnelStatus): Promise<RegistrationEntity>;
}
