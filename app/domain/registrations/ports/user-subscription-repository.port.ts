export const USER_SUBSCRIPTION_REPOSITORY_PORT = Symbol('USER_SUBSCRIPTION_REPOSITORY_PORT');

export type FormKind = 'registration' | 'post_event' | 'nps';

export type PipedriveStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface UserSubscriptionRow {
  id: string;
  eventId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  registrationAnswers: Record<string, unknown> | null;
  postEventAnswers: Record<string, unknown> | null;
  npsAnswers: Record<string, unknown> | null;
  sendToPipedrive: boolean;
  pipedriveStatus: PipedriveStatus | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertContact {
  name?: string;
  email?: string;
  phone?: string;
}

export interface UserSubscriptionRepositoryPort {
  findByEventAndContact(
    eventId: string,
    contact: { email?: string; phone?: string },
  ): Promise<UserSubscriptionRow | null>;
  create(data: {
    eventId: string;
    contact: UpsertContact;
    kind: FormKind;
    answers: Record<string, unknown>;
  }): Promise<UserSubscriptionRow>;
  update(
    id: string,
    data: { contact: UpsertContact; kind: FormKind; answers: Record<string, unknown> },
  ): Promise<UserSubscriptionRow>;
  setPipedrive(
    id: string,
    data: { sendToPipedrive: boolean; pipedriveStatus: PipedriveStatus },
  ): Promise<void>;
  findAllByEventPaginated(
    eventId: string,
    pagination: { skip: number; take: number },
    search?: string,
  ): Promise<{ data: UserSubscriptionRow[]; total: number }>;
  findAllByEvent(eventId: string, search?: string): Promise<UserSubscriptionRow[]>;
}
