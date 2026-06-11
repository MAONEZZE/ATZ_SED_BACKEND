import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { PrismaService } from '@database/prisma/prisma.service';
import { ResendAdapter } from '@database/integrations/resend.adapter';
import { EvolutionAdapter } from '@database/integrations/evolution.adapter';
import { QUEUE_MESSAGE_DISPATCH } from '@database/queue/bull-queues.module';
import { IcsGeneratorService } from '@services/automations/ics-generator.service';

const ICS_MARKER = '[[[ICS_INVITE]]]';

// Concurrency anti-ban: 1 = serial (uma conta WhatsApp não dispara em paralelo).
// Configurável via env; lido no carregamento do módulo (decorator).
@Processor(QUEUE_MESSAGE_DISPATCH, {
  concurrency: Number(process.env.WA_DISPATCH_CONCURRENCY) || 1,
  stalledInterval: 300_000,
  lockDuration: 60_000,
  lockRenewTime: 30_000,
  drainDelay: 5_000,
})
@Injectable()
export class MessageDispatchWorker extends WorkerHost {
  private readonly logger = new Logger(MessageDispatchWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resend: ResendAdapter,
    private readonly evolution: EvolutionAdapter,
    private readonly ics: IcsGeneratorService,
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
        let body = outbox.renderedBody;
        let icsContent: string | undefined;

        if (body.includes(ICS_MARKER) && outbox.eventId) {
          const event = await this.prisma.event.findUnique({
            where: { id: outbox.eventId },
            select: { title: true, eventDate: true, endDate: true, location: true },
          });
          if (event?.eventDate) {
            icsContent = this.ics.generate({
              title: event.title,
              start: event.eventDate,
              end: event.endDate ?? undefined,
              location: event.location ?? undefined,
            });
          }
          body = body.replace(ICS_MARKER, '');
        }

        await this.resend.sendEmail(
          outbox.recipient,
          outbox.renderedSubject ?? 'Mensagem do evento',
          body,
          icsContent,
        );
      } else {
        const instancia = await this.resolveWhatsAppInstance(
          outbox.eventId,
          outbox.ownerId,
          outbox.instancia,
        );
        if (!instancia) {
          throw new UnrecoverableError('WhatsApp message has no instancia configured');
        }
        await this.evolution.sendWhatsApp(instancia, outbox.recipient, outbox.renderedBody);
      }

      await this.prisma.outboxMessage.update({
        where: { id: outbox.id },
        data: { status: 'sent', processedAt: new Date() },
      });

      await this.prisma.messageLog.create({
        data: {
          eventId: outbox.eventId ?? null,
          ownerId: outbox.ownerId ?? null,
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
          ownerId: outbox.ownerId ?? null,
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

  private async resolveWhatsAppInstance(
    eventId: string | null,
    ownerId: string | null,
    fallback: string | null,
  ): Promise<string | null> {
    if (eventId) {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        select: { evolutionInstance: true, owner: { select: { evolutionInstance: true } } },
      });
      return event?.evolutionInstance ?? event?.owner?.evolutionInstance ?? null;
    }
    if (ownerId) {
      const profile = await this.prisma.profile.findUnique({
        where: { id: ownerId },
        select: { evolutionInstance: true },
      });
      return profile?.evolutionInstance ?? null;
    }
    return fallback ?? null;
  }
}
