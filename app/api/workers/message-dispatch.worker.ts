import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { PrismaService } from '@database/prisma/prisma.service';
import { ResendAdapter } from '@database/integrations/resend.adapter';
import { EvolutionAdapter } from '@database/integrations/evolution.adapter';
import { QUEUE_MESSAGE_DISPATCH } from '@database/queue/bull-queues.module';

@Processor(QUEUE_MESSAGE_DISPATCH)
@Injectable()
export class MessageDispatchWorker extends WorkerHost {
  private readonly logger = new Logger(MessageDispatchWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resend: ResendAdapter,
    private readonly evolution: EvolutionAdapter,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { outboxId, registrationId, templateId, trigger } = job.data as {
      outboxId?: string;
      registrationId?: string;
      templateId?: string;
      trigger?: string;
    };

    const outbox = outboxId
      ? await this.prisma.outboxMessage.findUnique({ where: { id: outboxId } })
      : // Legacy jobs enqueued before outboxId existed in the payload
        await this.prisma.outboxMessage.findFirst({
          where: {
            registrationId,
            templateId,
            trigger,
            status: { in: ['pending', 'processing'] },
          },
        });

    if (!outbox) {
      this.logger.warn(
        { outboxId, registrationId, templateId, trigger },
        'Outbox message not found — skipping',
      );
      return;
    }

    if (outbox.status === 'sent') {
      this.logger.debug({ id: outbox.id }, 'Message already sent — skipping');
      return;
    }

    await this.prisma.outboxMessage.update({
      where: { id: outbox.id },
      data: { status: 'processing', attempts: { increment: 1 } },
    });

    try {
      if (outbox.channel === 'email') {
        await this.resend.sendEmail(
          outbox.recipient,
          outbox.renderedSubject ?? 'Mensagem do evento',
          outbox.renderedBody,
        );
      } else {
        if (!outbox.instancia) {
          throw new UnrecoverableError('WhatsApp message has no instancia configured');
        }
        await this.evolution.sendWhatsApp(outbox.instancia, outbox.recipient, outbox.renderedBody);
      }

      await this.prisma.outboxMessage.update({
        where: { id: outbox.id },
        data: { status: 'sent', processedAt: new Date() },
      });

      await this.prisma.messageLog.create({
        data: {
          eventId: outbox.eventId ?? null,
          registrationId: outbox.registrationId ?? null,
          channel: outbox.channel,
          recipient: outbox.recipient,
          body: outbox.renderedBody,
          status: 'sent',
          sentAt: new Date(),
        },
      });

      this.logger.log({ id: outbox.id, channel: outbox.channel }, 'Message dispatched');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await this.prisma.outboxMessage.update({
        where: { id: outbox.id },
        data: { status: 'failed', errorMessage: msg },
      });
      await this.prisma.messageLog.create({
        data: {
          eventId: outbox.eventId ?? null,
          registrationId: outbox.registrationId ?? null,
          channel: outbox.channel,
          recipient: outbox.recipient,
          body: outbox.renderedBody,
          status: 'failed',
          errorMessage: msg,
        },
      });
      if (err instanceof UnrecoverableError) throw err;
      throw new Error(msg);
    }
  }
}
