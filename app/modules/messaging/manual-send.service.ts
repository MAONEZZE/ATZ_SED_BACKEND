import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomInt } from 'crypto';
import { DateTime } from 'luxon';
import { PrismaService } from '@infra/prisma/prisma.service';
import { STORAGE_PORT, StoragePort } from '@infra/storage/storage.port';
import { EventsService } from '@modules/events/events.service';
import { OutboxService } from '@modules/messaging/outbox.service';
import { TemplateRenderer } from '@modules/automations/template-renderer.service';
import type { MessageChannel } from '@modules/messaging/message-channel.type';
import type { InviteConfigInput, OutboxAttachment } from '@modules/messaging/ports/outbox-repository.port';

export interface ManualRecipientInput {
  name: string;
  email?: string;
  phone?: string;
}

export interface SendMessageInput {
  eventId?: string;
  instanceId?: string;
  channel: MessageChannel;
  templateId?: string;
  subject?: string;
  body?: string;
  registrationIds?: string[];
  manualRecipients?: ManualRecipientInput[];
  invite?: InviteConfigInput;
  attachments?: { path: string; filename: string; mimetype: string }[];
}

export interface SendMessageResult {
  queued: number;
  skipped: number;
  skippedReason: string[];
  batches: number;
}

interface ResolvedRecipient {
  registrationId?: string;
  name: string;
  email: string;
  phone: string;
}

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );
}

@Injectable()
export class ManualSendService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
    private readonly outbox: OutboxService,
    private readonly renderer: TemplateRenderer,
    private readonly config: ConfigService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async send(input: SendMessageInput, userId: string): Promise<SendMessageResult> {
    if (input.registrationIds?.length && !input.eventId) {
      throw new BadRequestException('registrationIds require an eventId');
    }

    if (input.invite) {
      if (!DateTime.fromISO(input.invite.date).isValid) {
        throw new BadRequestException('invite.date is not a valid calendar date');
      }
      if (!input.invite.allDay) {
        if (!input.invite.startTime || !input.invite.endTime) {
          throw new BadRequestException(
            'invite.startTime and invite.endTime are required when allDay is false',
          );
        }
        if (!DateTime.fromFormat(input.invite.startTime, 'HH:mm').isValid) {
          throw new BadRequestException('invite.startTime is not a valid time');
        }
        if (!DateTime.fromFormat(input.invite.endTime, 'HH:mm').isValid) {
          throw new BadRequestException('invite.endTime is not a valid time');
        }
      }
    }

    const bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'ATZ_SED';
    const attachmentFolder =
      this.config.get<string>('SUPABASE_STORAGE_BUCKET_MESSAGE_ATTACHMENTS') ?? 'message-attachments';
    let resolvedAttachments: OutboxAttachment[] | undefined;
    if (input.attachments?.length) {
      const prefix = `${attachmentFolder}/${userId}/`;
      resolvedAttachments = input.attachments.map((a) => {
        if (!a.path.startsWith(prefix) || a.path.includes('..')) {
          throw new BadRequestException('Attachment path does not belong to the sender');
        }
        return { url: this.storage.getPublicUrl(bucket, a.path), filename: a.filename, mimetype: a.mimetype };
      });
    }

    let eventContext: {
      id: string;
      title: string;
      eventDate: Date | null;
      location: string | null;
      capacity: number | null;
      dressCode: string | null;
      groupLink: string | null;
    } | null = null;

    let instancia: string | undefined;
    if (!input.eventId && input.instanceId) {
      const instance = await this.prisma.evolutionInstance.findUnique({
        where: { id: input.instanceId },
      });
      if (!instance) throw new NotFoundException('Evolution instance not found');
      instancia = instance.name;
    }

    // Atribuição da mensagem fica sempre com o dono do evento (resolve a instância
    // Evolution e os logs). Sem evento, atribui ao próprio remetente.
    let attributionOwnerId = userId;
    if (input.eventId) {
      const event = await this.eventsService.findById(input.eventId);
      const isOwner = event.ownerId === userId;
      const isCollaborator = isOwner
        ? false
        : (await this.prisma.eventCollaborator.count({
            where: { eventId: event.id, profileId: userId },
          })) > 0;
      if (!isOwner && !isCollaborator) {
        throw new ForbiddenException('You do not have access to this event');
      }
      attributionOwnerId = event.ownerId;
      eventContext = {
        id: event.id,
        title: event.title,
        eventDate: event.eventDate ?? null,
        location: event.location ?? null,
        capacity: event.capacity ?? null,
        dressCode: event.dressCode ?? null,
        groupLink: event.groupLink ?? null,
      };
    }

    let template: {
      id: string;
      channel: string;
      subject: string | null;
      body: string;
    } | null = null;
    if (input.templateId) {
      template = await this.prisma.messageTemplate.findFirst({
        where: { id: input.templateId, ownerId: userId },
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

    const registrations =
      input.registrationIds?.length && input.eventId
        ? await this.prisma.registration.findMany({
            where: { id: { in: input.registrationIds }, eventId: input.eventId },
          })
        : [];

    const allRecipients: ResolvedRecipient[] = [
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

    if (allRecipients.length === 0) {
      throw new BadRequestException('At least one recipient is required');
    }

    const skippedReason: string[] = [];
    let skipped = 0;
    const seenTargets = new Set<string>();
    const validRecipients: Array<{ recipient: ResolvedRecipient; target: string }> = [];

    for (const recipient of allRecipients) {
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
      validRecipients.push({ recipient, target });
    }

    const isWhatsapp = input.channel === 'whatsapp';
    const minDelay = this.config.get<number>('WA_MIN_DELAY_MS') ?? 8000;
    const maxDelay = this.config.get<number>('WA_MAX_DELAY_MS') ?? 30000;
    const batchSize = this.config.get<number>('MANUAL_BATCH_SIZE') ?? 10;
    const batchMinDelay = this.config.get<number>('MANUAL_BATCH_MIN_DELAY_MS') ?? 3_600_000;
    const batchMaxDelay = this.config.get<number>('MANUAL_BATCH_MAX_DELAY_MS') ?? 7_200_000;

    const batches = chunk(validRecipients, batchSize);
    let batchDelayCursor = 0;
    let queued = 0;

    for (let bi = 0; bi < batches.length; bi++) {
      if (isWhatsapp && bi > 0) {
        batchDelayCursor += randomInt(batchMinDelay, batchMaxDelay + 1);
      }

      let innerDelayCursor = 0;
      for (const { recipient, target } of batches[bi]) {
        if (isWhatsapp) innerDelayCursor += randomInt(minDelay, maxDelay + 1);

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

        // Envio manual é sempre único: sufixo aleatório evita que reenvios da
        // mesma mensagem ao mesmo destinatário sejam deduplicados pela fila
        // (o jobId do BullMQ é o dedupKey). Automações mantêm idempotência.
        const eventPrefix = input.eventId ?? 'global';
        const dedupKey = `manual:${eventPrefix}:${target}:${randomBytes(16).toString('hex')}`;

        await this.outbox.enqueue(
          {
            eventId: input.eventId,
            ownerId: attributionOwnerId,
            registrationId: recipient.registrationId!,
            templateId: template?.id,
            trigger: 'manual',
            dedupKey,
            channel: input.channel,
            recipient: target,
            instancia,
            renderedBody,
            renderedSubject,
            inviteConfig: input.invite ?? null,
            attachments: resolvedAttachments,
          },
          { delayMs: isWhatsapp ? batchDelayCursor + innerDelayCursor : 0 },
        );
        queued++;
      }
    }

    return { queued, skipped, skippedReason, batches: batches.length };
  }
}
