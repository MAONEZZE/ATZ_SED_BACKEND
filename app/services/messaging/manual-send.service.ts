import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '@database/prisma/prisma.service';
import { EventsService } from '@services/events/events.service';
import { OutboxService } from '@services/messaging/outbox.service';
import { TemplateRenderer } from '@services/automations/template-renderer.service';
import type { MessageChannel } from '@domain/messaging/types/message-channel.type';

export interface ManualRecipientInput {
  name: string;
  email?: string;
  phone?: string;
}

export interface SendMessageInput {
  eventId?: string;
  instancia?: string;
  channel: MessageChannel;
  templateId?: string;
  subject?: string;
  body?: string;
  registrationIds?: string[];
  manualRecipients?: ManualRecipientInput[];
}

export interface SendMessageResult {
  queued: number;
  skipped: number;
  skippedReason: string[];
}

interface ResolvedRecipient {
  registrationId?: string;
  name: string;
  email: string;
  phone: string;
}

@Injectable()
export class ManualSendService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
    private readonly outbox: OutboxService,
    private readonly renderer: TemplateRenderer,
    private readonly config: ConfigService,
  ) {}

  async send(input: SendMessageInput, userId: string): Promise<SendMessageResult> {
    // Guard: registrationIds só com eventId
    if (input.registrationIds?.length && !input.eventId) {
      throw new BadRequestException('registrationIds require an eventId');
    }
    // Guard: WhatsApp sem evento exige instancia no body
    if (input.channel === 'whatsapp' && !input.eventId && !input.instancia) {
      throw new BadRequestException('instancia is required for WhatsApp when no eventId is provided');
    }

    // Resolve evento (ownership) ou instancia avulsa
    let resolvedInstancia: string | undefined;
    let eventContext: {
      id: string;
      title: string;
      eventDate: Date | null;
      location: string | null;
      capacity: number | null;
      dressCode: string | null;
      groupLink: string | null;
      evolutionInstance?: string;
    } | null = null;

    if (input.eventId) {
      const event = await this.eventsService.findById(input.eventId);
      if (event.ownerId !== userId) {
        throw new ForbiddenException('You do not own this event');
      }
      resolvedInstancia = event.evolutionInstance ?? undefined;
      eventContext = {
        id: event.id,
        title: event.title,
        eventDate: event.eventDate ?? null,
        location: event.location ?? null,
        capacity: event.capacity ?? null,
        dressCode: event.dressCode ?? null,
        groupLink: event.groupLink ?? null,
        evolutionInstance: event.evolutionInstance,
      };
    } else {
      resolvedInstancia = input.instancia;
    }

    // Resolve template (opcional)
    let template: {
      id: string;
      channel: string;
      subject: string | null;
      body: string;
    } | null = null;
    if (input.templateId) {
      template = await this.prisma.messageTemplate.findFirst({
        where: {
          id: input.templateId,
          ...(input.eventId ? { eventId: input.eventId } : {}),
        },
      });
      if (!template) throw new NotFoundException('Template not found');
      if (template.channel !== input.channel) {
        throw new BadRequestException(
          `Template channel '${template.channel}' does not match requested channel '${input.channel}'`,
        );
      }
    }

    const bodySource = input.body ?? template?.body;
    if (!bodySource) {
      throw new BadRequestException('Either templateId or body is required');
    }
    const subjectSource = input.subject ?? template?.subject ?? undefined;

    // Resolve destinatários
    const registrations =
      input.registrationIds?.length && input.eventId
        ? await this.prisma.registration.findMany({
            where: { id: { in: input.registrationIds }, eventId: input.eventId },
          })
        : [];
    const recipients: ResolvedRecipient[] = [
      ...registrations.map((r) => ({
        registrationId: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
      })),
      ...(input.manualRecipients ?? []).map((m) => ({
        name: m.name,
        email: m.email ?? '',
        phone: m.phone ?? '',
      })),
    ];
    if (recipients.length === 0) {
      throw new BadRequestException('At least one recipient is required');
    }

    const skippedReason: string[] = [];
    let queued = 0;
    let skipped = 0;
    const seenTargets = new Set<string>();

    const isWhatsapp = input.channel === 'whatsapp';
    const minDelay = this.config.get<number>('WA_MIN_DELAY_MS') ?? 8000;
    const maxDelay = this.config.get<number>('WA_MAX_DELAY_MS') ?? 30000;
    let delayCursor = 0;

    for (const recipient of recipients) {
      const target = input.channel === 'email' ? recipient.email : recipient.phone;
      if (!target) {
        skipped++;
        skippedReason.push(
          input.channel === 'email'
            ? `${recipient.name}: sem email`
            : `${recipient.name}: sem telefone`,
        );
        continue;
      }
      if (seenTargets.has(target)) {
        skipped++;
        skippedReason.push(`${recipient.name}: destinatário duplicado (${target})`);
        continue;
      }
      seenTargets.add(target);

      const variables = this.renderer.buildVariables({
        registration: {
          name: recipient.name,
          email: recipient.email,
          phone: recipient.phone,
        },
        event: eventContext ?? undefined,
      });
      const renderedBody = this.renderer.render(bodySource, variables);
      const renderedSubject = subjectSource
        ? this.renderer.render(subjectSource, variables)
        : undefined;

      const hash = createHash('sha1').update(renderedBody).digest('hex');
      const eventPrefix = input.eventId ?? 'global';
      const dedupKey = `manual:${eventPrefix}:${target}:${hash}`;

      if (isWhatsapp) delayCursor += randomInt(minDelay, maxDelay + 1);
      await this.outbox.enqueue(
        {
          eventId: input.eventId,
          registrationId: recipient.registrationId,
          templateId: template?.id,
          trigger: 'manual',
          dedupKey,
          channel: input.channel,
          recipient: target,
          instancia: resolvedInstancia,
          renderedBody,
          renderedSubject,
        },
        { delayMs: isWhatsapp ? delayCursor : 0 },
      );
      queued++;
    }

    return { queued, skipped, skippedReason };
  }
}
