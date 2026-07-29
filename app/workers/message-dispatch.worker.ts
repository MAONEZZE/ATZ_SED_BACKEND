import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, UnrecoverableError, DelayedError } from 'bullmq';
import { PrismaService } from '@infra/prisma/prisma.service';
import { ResendAdapter } from '@infra/integrations/resend.adapter';
import { UazapiAdapter } from '@infra/integrations/uazapi.adapter';
import { QUEUE_MESSAGE_DISPATCH } from '@infra/queue/bull-queues.module';
import { WhatsappPacingService } from '@modules/messaging/whatsapp-pacing.service';
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

  private readonly gateEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly resend: ResendAdapter,
    private readonly uazapi: UazapiAdapter,
    private readonly ics: IcsGeneratorService,
    private readonly pacing: WhatsappPacingService,
    config: ConfigService,
  ) {
    super();
    this.gateEnabled = config.get<boolean>('DISPATCH_GATE_ENABLED') ?? false;
  }

  async process(job: Job, token?: string): Promise<void> {
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

    // Gate de re-pacing no retry (DISPATCH_GATE_ENABLED). A 1ª tentativa já foi
    // espaçada no enqueue; retries (attemptsMade>=1) bypassariam o gap anti-ban, então
    // reservam um slot novo no cursor compartilhado e são reagendados (moveToDelayed).
    // reserve-once-and-honor: o marcador pacedForAttempt evita reservar 2x na mesma
    // tentativa (DelayedError NÃO incrementa attemptsMade), impedindo drift do cursor.
    if (this.gateEnabled && outbox.channel === 'whatsapp' && token) {
      const wToken = await this.resolveWhatsAppInstance(outbox.eventId, outbox.instancia);
      const data = job.data as { pacedForAttempt?: number };
      if (wToken && job.attemptsMade >= 1 && data.pacedForAttempt !== job.attemptsMade) {
        const extra = await this.pacing.nextDelayMs(wToken);
        await job.updateData({ ...job.data, pacedForAttempt: job.attemptsMade });
        if (extra > 0) {
          await job.moveToDelayed(Date.now() + extra, token);
          throw new DelayedError();
        }
      }
    }

    await this.prisma.outboxMessage.update({
      where: { id: outbox.id },
      data: { status: 'processing', attempts: { increment: 1 } },
    });

    try {
      let whatsappMessageId: string | null = null;
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
        const token = await this.resolveWhatsAppInstance(outbox.eventId, outbox.instancia);
        if (!token) {
          throw new UnrecoverableError('WhatsApp message has no Uazapi token configured');
        }
        // track_id = outbox.id: o webhook de status devolve esse id, correlacionando
        // a confirmação de entrega/leitura de volta com esta mensagem.
        let providerMessageId = await this.uazapi.sendWhatsApp(
          token,
          outbox.recipient,
          outbox.renderedBody,
          {
            startIndex: outbox.sentParts,
            trackId: outbox.id,
            onPartSent: async (index) => {
              await this.prisma.outboxMessage.update({
                where: { id: outbox.id },
                data: { sentParts: index + 1 },
              });
            },
          },
        );

        const attachments = (outbox.attachments as OutboxAttachment[] | null) ?? [];
        for (let i = outbox.sentAttachments; i < attachments.length; i++) {
          const a = attachments[i];
          const mediaMessageId = await this.uazapi.sendMedia(
            token,
            outbox.recipient,
            a.url,
            this.mediaTypeOf(a.mimetype),
            a.mimetype,
            a.filename,
            undefined,
            outbox.id,
          );
          providerMessageId = mediaMessageId ?? providerMessageId;
          await this.prisma.outboxMessage.update({
            where: { id: outbox.id },
            data: { sentAttachments: i + 1 },
          });
        }

        whatsappMessageId = providerMessageId;
      }

      await this.prisma.outboxMessage.update({
        where: { id: outbox.id },
        data: { status: 'sent', processedAt: new Date(), providerMessageId: whatsappMessageId },
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
          providerMessageId: whatsappMessageId,
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

  // Resolve o token Uazapi da instância. `fallback` (outbox.instancia) já carrega
  // o token quando o disparo não está vinculado a um evento.
  private async resolveWhatsAppInstance(
    eventId: string | null,
    fallback: string | null,
  ): Promise<string | null> {
    if (fallback) return fallback;
    if (eventId) {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        select: { uazapiInstance: { select: { token: true } } },
      });
      return event?.uazapiInstance?.token ?? null;
    }
    return null;
  }

  private mediaTypeOf(mimetype: string): 'image' | 'video' | 'audio' | 'document' {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    return 'document';
  }
}
