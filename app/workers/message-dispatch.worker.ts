import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { PrismaService } from '@infra/prisma/prisma.service';
import { ResendAdapter } from '@infra/integrations/resend.adapter';
import { EvolutionAdapter } from '@infra/integrations/evolution.adapter';
import { QUEUE_MESSAGE_DISPATCH } from '@infra/queue/bull-queues.module';
import { IcsGeneratorService } from '@modules/automations/ics-generator.service';
import type { InviteConfigInput, OutboxAttachment } from '@modules/messaging/ports/outbox-repository.port';
import { APP_TIMEZONE } from '@shared/timezone';
import { DateTime } from 'luxon';

const ICS_MARKER = '[[[ICS_INVITE]]]';
const ICS_MARKER_RECURRENT = '[[[ICS_INVITE_RECURRENT]]]';

@Processor(QUEUE_MESSAGE_DISPATCH, {
  concurrency: Number(process.env.WA_DISPATCH_CONCURRENCY) || 1,
  stalledInterval: Number(process.env.QUEUE_STALLED_INTERVAL_MS) || 600_000,
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
      : await this.prisma.outboxMessage.findFirst({
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

        const wantsRecurrent = body.includes(ICS_MARKER_RECURRENT);
        const wantsInvite = wantsRecurrent || body.includes(ICS_MARKER);

        if (wantsInvite) {
          icsContent = await this.buildInvite(outbox, wantsRecurrent);
          body = body.replace(ICS_MARKER_RECURRENT, '').replace(ICS_MARKER, '');
        }

        const emailAttachments = ((outbox.attachments as OutboxAttachment[] | null) ?? []).map((a) => ({
          filename: a.filename,
          url: a.url,
        }));

        await this.resend.sendEmail(
          outbox.recipient,
          outbox.renderedSubject ?? 'Mensagem do evento',
          body,
          icsContent,
          emailAttachments.length ? emailAttachments : undefined,
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
        await this.evolution.sendWhatsApp(instancia, outbox.recipient, outbox.renderedBody, {
          startIndex: outbox.sentParts,
          onPartSent: async (index) => {
            await this.prisma.outboxMessage.update({
              where: { id: outbox.id },
              data: { sentParts: index + 1 },
            });
          },
        });

        const attachments = (outbox.attachments as OutboxAttachment[] | null) ?? [];
        for (let i = outbox.sentAttachments; i < attachments.length; i++) {
          const a = attachments[i];
          await this.evolution.sendMedia(
            instancia,
            outbox.recipient,
            a.url,
            this.mediaTypeOf(a.mimetype),
            a.mimetype,
            a.filename,
          );
          await this.prisma.outboxMessage.update({
            where: { id: outbox.id },
            data: { sentAttachments: i + 1 },
          });
        }
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

  /**
   * Gera o .ics do convite. Precedência:
   *  (a) outbox.inviteConfig (payload do envio manual) — usa date/horários/timezone
   *      e recorrência informados; ancora o instante no timezone IANA do config.
   *  (b) fallback: deriva do Event (eventDate/endDate + recurrence* do evento),
   *      renderizando no timezone da aplicação.
   * UID estável por (eventId + destinatário) evita duplicação no calendário em reenvios.
   */
  private async buildInvite(
    outbox: {
      eventId: string | null;
      recipient: string;
      renderedSubject: string | null;
      inviteConfig: unknown;
    },
    wantsRecurrent: boolean,
  ): Promise<string | undefined> {
    const event = outbox.eventId
      ? await this.prisma.event.findUnique({
          where: { id: outbox.eventId },
          select: {
            title: true,
            eventDate: true,
            endDate: true,
            location: true,
            recurrenceFreq: true,
            recurrenceInterval: true,
            recurrenceUntil: true,
          },
        })
      : null;

    const uid = `invite-${outbox.eventId ?? 'global'}-${outbox.recipient}`;
    const cfg = (outbox.inviteConfig as InviteConfigInput | null) ?? null;

    // (a) Config explícita no payload.
    if (cfg) {
      const tz = cfg.timezone || APP_TIMEZONE;
      const start = DateTime.fromISO(`${cfg.date}T${cfg.allDay ? '00:00' : cfg.startTime}`, {
        zone: tz,
      }).toJSDate();
      const end =
        cfg.allDay || !cfg.endTime
          ? undefined
          : DateTime.fromISO(`${cfg.date}T${cfg.endTime}`, { zone: tz }).toJSDate();
      const repeating =
        wantsRecurrent && cfg.recurrence
          ? {
              freq: cfg.recurrence.freq,
              interval: cfg.recurrence.interval,
              until: cfg.recurrence.until ? new Date(cfg.recurrence.until) : undefined,
            }
          : undefined;
      return this.ics.generate({
        title: event?.title ?? outbox.renderedSubject ?? 'Convite',
        start,
        end,
        allDay: cfg.allDay ?? false,
        timezone: tz,
        location: event?.location ?? undefined,
        uid,
        repeating,
      });
    }

    // (b) Fallback: deriva do Event.
    if (event?.eventDate) {
      const repeating =
        wantsRecurrent && event.recurrenceFreq
          ? {
              freq: event.recurrenceFreq,
              interval: event.recurrenceInterval ?? undefined,
              until: event.recurrenceUntil ?? undefined,
            }
          : undefined;
      return this.ics.generate({
        title: event.title,
        start: event.eventDate,
        end: event.endDate ?? undefined,
        timezone: APP_TIMEZONE,
        location: event.location ?? undefined,
        uid,
        repeating,
      });
    }

    return undefined;
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

  private mediaTypeOf(mimetype: string): 'image' | 'video' | 'audio' | 'document' {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    return 'document';
  }
}
