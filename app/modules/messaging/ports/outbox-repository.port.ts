import type { MessageChannel } from '@modules/messaging/message-channel.type';

export const OUTBOX_REPOSITORY_PORT = Symbol('OUTBOX_REPOSITORY_PORT');

export interface InviteRecurrenceInput {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  /** ISO 8601. Ausente = recorrência infinita. */
  until?: string;
}

export interface InviteConfigInput {
  /** YYYY-MM-DD */
  date: string;
  allDay?: boolean;
  /** HH:mm — obrigatório quando allDay é falso. */
  startTime?: string;
  /** HH:mm — obrigatório quando allDay é falso. */
  endTime?: string;
  /** IANA timezone. */
  timezone: string;
  recurrence?: InviteRecurrenceInput | null;
}

export interface OutboxAttachment {
  /** URL pública resolvida server-side (não vem do client). */
  url: string;
  filename: string;
  mimetype: string;
}

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
  inviteConfig?: InviteConfigInput | null;
  attachments?: OutboxAttachment[];
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

export interface OutboxDeliveryTarget {
  /** id da mensagem no provedor (whatsapp messageid) */
  providerMessageId?: string | null;
  /** track_id que enviamos = OutboxMessage.id */
  trackId?: string | null;
}

export interface OutboxDispatchMessage {
  id: string;
  eventId: string | null;
  ownerId: string | null;
  registrationId: string | null;
  channel: MessageChannel;
  recipient: string;
  instancia: string | null;
  renderedBody: string;
  renderedSubject: string | null;
  inviteConfig: unknown;
  attachments: unknown;
  sentParts: number;
  sentAttachments: number;
  status: string;
}

export interface OutboxRepositoryPort {
  enqueue(
    data: EnqueueMessageData & { dedupKey: string },
  ): Promise<{ id: string; created: boolean }>;
  claimStuck(olderThanMinutes: number): Promise<number>;
  markProcessing(id: string): Promise<void>;
  markSent(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  getPending(limit: number): Promise<PendingOutboxMessage[]>;
  markDeliveredIfUnset(target: OutboxDeliveryTarget, at: Date): Promise<void>;
  markReadIfUnset(target: OutboxDeliveryTarget, at: Date): Promise<void>;
  markFailedIfUndelivered(target: OutboxDeliveryTarget, error: string): Promise<void>;
  findDispatchById(id: string): Promise<OutboxDispatchMessage | null>;
  findPendingDispatchByTrigger(
    registrationId: string | undefined,
    templateId: string | undefined,
    trigger: string | undefined,
  ): Promise<OutboxDispatchMessage | null>;
  markProcessingAttempt(id: string): Promise<void>;
  updateSentParts(id: string, sentParts: number): Promise<void>;
  updateSentAttachments(id: string, sentAttachments: number): Promise<void>;
  markDispatchSent(id: string, providerMessageId: string | null): Promise<void>;
  markDispatchFailed(id: string, error: string): Promise<void>;
}
