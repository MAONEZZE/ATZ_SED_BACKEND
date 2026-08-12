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
import { STORAGE_PORT, StoragePort } from '@domain/shared/i-storage';
import { OutboxService } from '@application/outbox_module/outbox.service';
import { TemplateRenderer } from '@application/shared/template-renderer.service';
import {
  MESSAGE_TEMPLATE_REPOSITORY_PORT,
  MessageTemplateRepositoryPort,
} from '@domain/message_template_module/i-repository-message-template';
import {
  WHATSAPP_INSTANCE_REPOSITORY_PORT,
  WhatsappInstanceRepositoryPort,
} from '@domain/whatsapp_instance_module/i-repository-whatsapp-instance';
import {
  COLLABORATOR_REPOSITORY_PORT,
  CollaboratorRepositoryPort,
} from '@domain/collaborator_module/i-repository-collaborator';
import {
  EVENT_REPOSITORY_PORT,
  EventRepositoryPort,
} from '@domain/event_module/i-repository-event';
import {
  REGISTRATION_REPOSITORY_PORT,
  RegistrationRepositoryPort,
} from '@domain/registration_module/i-repository-registration';
import type { MessageChannel } from '@domain/shared/message-channel.type';
import type {
  InviteConfigInput,
  OutboxAttachment,
} from '@domain/outbox_module/i-repository-outbox';

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
  /** JIDs de grupos WhatsApp (@g.us) como destinatários. Só canal whatsapp. */
  groupIds?: string[];
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
    private readonly outbox: OutboxService,
    private readonly renderer: TemplateRenderer,
    private readonly config: ConfigService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject(MESSAGE_TEMPLATE_REPOSITORY_PORT)
    private readonly templates: MessageTemplateRepositoryPort,
    @Inject(WHATSAPP_INSTANCE_REPOSITORY_PORT)
    private readonly whatsappInstances: WhatsappInstanceRepositoryPort,
    @Inject(COLLABORATOR_REPOSITORY_PORT)
    private readonly collaborators: CollaboratorRepositoryPort,
    @Inject(EVENT_REPOSITORY_PORT) private readonly eventRepo: EventRepositoryPort,
    @Inject(REGISTRATION_REPOSITORY_PORT)
    private readonly registrations: RegistrationRepositoryPort,
  ) {}

  async send(input: SendMessageInput, userId: string): Promise<SendMessageResult> {
    if (input.registrationIds?.length && !input.eventId) {
      throw new BadRequestException('registrationIds require an eventId');
    }

    if (input.groupIds?.length && input.channel !== 'whatsapp') {
      throw new BadRequestException('groupIds are only valid for the whatsapp channel');
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
      this.config.get<string>('SUPABASE_STORAGE_BUCKET_MESSAGE_ATTACHMENTS') ??
      'message-attachments';
    let resolvedAttachments: OutboxAttachment[] | undefined;
    if (input.attachments?.length) {
      const prefix = `${attachmentFolder}/${userId}/`;
      resolvedAttachments = input.attachments.map((a) => {
        if (!a.path.startsWith(prefix) || a.path.includes('..')) {
          throw new BadRequestException('Attachment path does not belong to the sender');
        }
        return {
          url: this.storage.getPublicUrl(bucket, a.path),
          filename: a.filename,
          mimetype: a.mimetype,
        };
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

    // `instancia` carrega o token Whatsapp da instância (a Whatsapp autentica por token).
    let instancia: string | undefined;
    if (!input.eventId && input.instanceId) {
      const instance = await this.whatsappInstances.findById(input.instanceId);
      if (!instance) throw new NotFoundException('Whatsapp instance not found');
      if (!instance.hasToken())
        throw new BadRequestException('Whatsapp instance has no token configured');
      instancia = instance.token!;
    }

    // Atribuição da mensagem fica sempre com o dono do evento (resolve a instância
    // Whatsapp e os logs). Sem evento, atribui ao próprio remetente.
    let attributionOwnerId = userId;
    if (input.eventId) {
      const event = await this.eventRepo.findById(input.eventId);
      if (!event) throw new NotFoundException('Event not found');
      const isOwner = event.ownerId === userId;
      const isCollaborator = isOwner
        ? false
        : await this.collaborators.isCollaborator(event.id, userId);
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
      template = await this.templates.findByIdForOwner(input.templateId, userId);
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
        ? await this.registrations.findByIdsAndEvent(input.registrationIds, input.eventId)
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
      // Grupos: o JID @g.us entra como destinatário (campo `number` da Whatsapp).
      ...(input.groupIds ?? []).map((jid) => ({
        name: 'Grupo',
        email: '',
        phone: jid,
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
    const gate = this.config.get<boolean>('DISPATCH_GATE_ENABLED') ?? false;
    const minDelay = this.config.get<number>('WA_MIN_DELAY_MS') ?? 8000;
    const maxDelay = this.config.get<number>('WA_MAX_DELAY_MS') ?? 30000;
    const batchSize = this.config.get<number>('MANUAL_BATCH_SIZE') ?? 10;
    const batchMinDelay = this.config.get<number>('MANUAL_BATCH_MIN_DELAY_MS') ?? 3_600_000;
    const batchMaxDelay = this.config.get<number>('MANUAL_BATCH_MAX_DELAY_MS') ?? 7_200_000;

    // Gate ON: roteia o whatsapp pelo cursor compartilhado (mesmo de automações),
    // em vez do delay cumulativo pré-calculado. Precisa do token da instância.
    // Non-event já tem em `instancia`; event-scoped resolve do evento.
    let paceToken = instancia;
    if (gate && isWhatsapp && !paceToken && input.eventId) {
      paceToken = (await this.eventRepo.findWhatsappInstanceToken(input.eventId)) ?? undefined;
    }

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

        // Gate ON + whatsapp com token: reserva no cursor compartilhado e preserva
        // o gap de lote como offset aditivo. Senão, legado: delay cumulativo pré-calc.
        const opts =
          gate && isWhatsapp && paceToken
            ? { paceInstancia: paceToken, extraDelayMs: batchDelayCursor }
            : { delayMs: isWhatsapp ? batchDelayCursor + innerDelayCursor : 0 };

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
          opts,
        );
        queued++;
      }
    }

    return { queued, skipped, skippedReason, batches: batches.length };
  }
}
