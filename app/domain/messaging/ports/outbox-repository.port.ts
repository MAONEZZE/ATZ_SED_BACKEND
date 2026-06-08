import type { MessageChannel } from '@domain/messaging/types/message-channel.type';

export const OUTBOX_REPOSITORY_PORT = Symbol('OUTBOX_REPOSITORY_PORT');

export interface EnqueueMessageData {
  eventId?: string;
  ownerId?: string;
  registrationId?: string;
  templateId?: string;
  trigger: string;
  dedupKey?: string;
  channel: MessageChannel;
  recipient: string;
  instancia?: string;
  renderedBody: string;
  renderedSubject?: string;
}

export interface PendingOutboxMessage {
  id: string;
  registrationId: string | null;
  channel: MessageChannel;
  recipient: string;
  instancia: string | null;
  renderedBody: string;
  renderedSubject: string | null;
  templateId: string | null;
  trigger: string;
}

export interface OutboxRepositoryPort {
  enqueue(data: EnqueueMessageData & { dedupKey: string }): Promise<{ id: string }>;
  claimStuck(olderThanMinutes: number): Promise<number>;
  markProcessing(id: string): Promise<void>;
  markSent(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  getPending(limit: number): Promise<PendingOutboxMessage[]>;
}
