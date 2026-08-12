import { FormKind } from '@domain/shared/form-kind.type';
import { PipedriveStatus, UserSubscriptionEntity } from './user-subscription.entity';

export const USER_SUBSCRIPTION_REPOSITORY_PORT = Symbol('USER_SUBSCRIPTION_REPOSITORY_PORT');

export interface UpsertContact {
  name?: string;
  email?: string;
  phone?: string;
}

export interface UserSubscriptionRepositoryPort {
  findByEventAndContact(
    eventId: string,
    contact: { email?: string; phone?: string },
  ): Promise<UserSubscriptionEntity | null>;
  create(data: {
    eventId: string;
    contact: UpsertContact;
    kind: FormKind;
    answers: Record<string, unknown>;
  }): Promise<UserSubscriptionEntity>;
  update(
    id: string,
    data: { contact: UpsertContact; kind: FormKind; answers: Record<string, unknown> },
  ): Promise<UserSubscriptionEntity>;
  setPipedrive(
    id: string,
    data: { sendToPipedrive: boolean; pipedriveStatus: PipedriveStatus },
  ): Promise<void>;
  findAllByEventPaginated(
    eventId: string,
    pagination: { skip: number; take: number },
    search?: string,
  ): Promise<{ data: UserSubscriptionEntity[]; total: number }>;
  findAllByEvent(eventId: string, search?: string): Promise<UserSubscriptionEntity[]>;
}
