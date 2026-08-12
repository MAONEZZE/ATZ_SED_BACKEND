import { OutboxMessageEntity } from '@domain/outbox_module/outbox-message.entity';
import { UserSubscriptionEntity } from '@domain/user_subscription_module/user-subscription.entity';

function outbox(sentParts = 0, sentAttachments = 0, channel: 'whatsapp' | 'email' = 'whatsapp') {
  return new OutboxMessageEntity(
    'msg-1',
    null,
    null,
    null,
    channel,
    'a@b.test',
    null,
    'corpo',
    null,
    null,
    null,
    sentParts,
    sentAttachments,
    'pending',
  );
}

// Retomar de onde parou é o que impede o destinatário de receber duas vezes a
// mesma parte quando uma tentativa falha no meio.
describe('OutboxMessageEntity resume', () => {
  it('is not resuming on a first attempt', () => {
    expect(outbox().isResuming()).toBe(false);
    expect(outbox().nextPartIndex()).toBe(0);
    expect(outbox().nextAttachmentIndex()).toBe(0);
  });

  it('resumes from the part after the last one sent', () => {
    expect(outbox(2).isResuming()).toBe(true);
    expect(outbox(2).nextPartIndex()).toBe(2);
  });

  it('resumes when only attachments had gone out', () => {
    expect(outbox(0, 1).isResuming()).toBe(true);
    expect(outbox(0, 1).nextAttachmentIndex()).toBe(1);
  });

  it('only whatsapp needs an instance token', () => {
    expect(outbox(0, 0, 'whatsapp').requiresInstance()).toBe(true);
    expect(outbox(0, 0, 'email').requiresInstance()).toBe(false);
  });
});

function subscription(
  reg: Record<string, unknown> | null,
  post: Record<string, unknown> | null,
  nps: Record<string, unknown> | null,
  sendToPipedrive = false,
  status: 'pending' | 'sent' | 'failed' | 'skipped' | null = null,
) {
  return new UserSubscriptionEntity(
    'sub-1',
    'evt-1',
    'Alice',
    'a@b.test',
    '5511999999999',
    reg,
    post,
    nps,
    sendToPipedrive,
    status,
    new Date(),
    new Date(),
  );
}

describe('UserSubscriptionEntity', () => {
  it('is complete only once all three form scopes answered', () => {
    expect(subscription({}, {}, {}).isComplete()).toBe(true);
    expect(subscription({}, {}, null).isComplete()).toBe(false);
    expect(subscription(null, null, null).isComplete()).toBe(false);
  });

  it('is not pending for the CRM when not flagged', () => {
    expect(subscription({}, null, null, false, null).isPendingPipedrive()).toBe(false);
  });

  it('is pending while not yet sent', () => {
    expect(subscription({}, null, null, true, 'pending').isPendingPipedrive()).toBe(true);
  });

  // Uma falha de envio precisa poder ser retentada.
  it('counts a failed send as still pending', () => {
    expect(subscription({}, null, null, true, 'failed').isPendingPipedrive()).toBe(true);
  });

  it('stops being pending after a successful send', () => {
    expect(subscription({}, null, null, true, 'sent').isPendingPipedrive()).toBe(false);
  });
});
