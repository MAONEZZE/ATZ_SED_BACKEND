import { OutboxMessageEntity } from '@domain/outbox_module/outbox-message.entity';

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
