import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
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
  ) {}

  async send(eventId: string, input: SendMessageInput): Promise<SendMessageResult> {
    const event = await this.eventsService.findById(eventId);

    // Resolve template (optional) and validate channel match
    let template: {
      id: string;
      channel: string;
      subject: string | null;
      body: string;
    } | null = null;
    if (input.templateId) {
      template = await this.prisma.messageTemplate.findFirst({
        where: { id: input.templateId, eventId },
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

    // Resolve recipients: registrations (scoped to event) + manual ad-hoc
    const registrations = input.registrationIds?.length
      ? await this.prisma.registration.findMany({
          where: { id: { in: input.registrationIds }, eventId },
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
        event,
      });
      const renderedBody = this.renderer.render(bodySource, variables);
      const renderedSubject = subjectSource
        ? this.renderer.render(subjectSource, variables)
        : undefined;

      const hash = createHash('sha1').update(renderedBody).digest('hex');
      await this.outbox.enqueue({
        eventId,
        registrationId: recipient.registrationId,
        templateId: template?.id,
        trigger: 'manual',
        dedupKey: `manual:${eventId}:${target}:${hash}`,
        channel: input.channel,
        recipient: target,
        instancia: event.evolutionInstance ?? undefined,
        renderedBody,
        renderedSubject,
      });
      queued++;
    }

    return { queued, skipped, skippedReason };
  }
}
