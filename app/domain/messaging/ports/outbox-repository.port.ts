import type { MessageChannel } from '@domain/messaging/types/message-channel.type';

export const OUTBOX_REPOSITORY_PORT = Symbol('OUTBOX_REPOSITORY_PORT');

export interface EnqueueMessageData {
  registrationId: string;
  templateId: string;
  trigger: string;
  channel: MessageChannel;
  recipient: string;
  instancia?: string;
  renderedBody: string;
  renderedSubject?: string;
}

export interface PendingOutboxMessage {
  id: string;
  registrationId: string;
  channel: MessageChannel;
  recipient: string;
  instancia: string | null;
  renderedBody: string;
  renderedSubject: string | null;
  templateId: string;
  trigger: string;
}

export interface OutboxRepositoryPort {
  enqueue(data: EnqueueMessageData): Promise<void>;
  claimStuck(olderThanMinutes: number): Promise<number>;
  markProcessing(id: string): Promise<void>;
  markSent(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  getPending(limit: number): Promise<PendingOutboxMessage[]>;
}
