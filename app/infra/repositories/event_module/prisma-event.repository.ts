import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@infra/prisma/prisma.service';
import {
  EventRepositoryPort,
  CreateEventData,
  UpdateEventData,
  EventOwnership,
  EventDuplicationSource,
  CreateDuplicateEventGraphData,
  CreateDuplicateEventGraphResult,
  PublicEventSummary,
  EventAutomationContext,
  EventWithMyRole,
} from '@domain/event_module/i-repository-event';

const PUBLIC_EVENT_SELECT = {
  id: true,
  title: true,
  slug: true,
  coverUrl: true,
  location: true,
  capacity: true,
  dressCode: true,
  eventDate: true,
  endDate: true,
  status: true,
} as const;
import { EventEntity, EventStatus } from '@domain/event_module/event.entity';
import { EventRole } from '@domain/collaborator_module/event-role.type';
import { resequence } from '@domain/shared/resequence';
import { writesFor } from '@infra/repositories/shared/order-writes';
import { StoredAttachment } from '@domain/shared/file-reference';

interface EventRow {
  id: string;
  ownerId: string;
  title: string;
  slug: string;
  status: string;
  coverUrl: string | null;
  location: string | null;
  capacity: number | null;
  dressCode: string | null;
  groupLink: string | null;
  eventDate: Date | null;
  endDate: Date | null;
  whatsappInstanceId: string | null;
  whatsappToken: string | null;
  lastEditedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  recurrenceFreq: string | null;
  recurrenceInterval: number | null;
  recurrenceUntil: Date | null;
  folderId: string | null;
  order: number;
}

@Injectable()
export class PrismaEventRepository implements EventRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  private map(row: EventRow): EventEntity {
    return new EventEntity(
      row.id,
      row.ownerId,
      row.title,
      row.slug,
      row.status as EventStatus,
      row.coverUrl ?? undefined,
      row.location ?? undefined,
      row.capacity ?? undefined,
      row.dressCode ?? undefined,
      row.groupLink ?? undefined,
      row.eventDate ?? undefined,
      row.whatsappInstanceId ?? undefined,
      row.whatsappToken ?? undefined,
      row.createdAt,
      row.updatedAt,
      row.endDate ?? undefined,
      row.lastEditedById ?? undefined,
      row.recurrenceFreq ?? undefined,
      row.recurrenceInterval ?? undefined,
      row.recurrenceUntil ?? undefined,
      row.folderId,
      row.order,
    );
  }

  async findById(id: string): Promise<EventEntity | null> {
    const row = await this.prisma.event.findUnique({ where: { id } });
    return row ? this.map(row) : null;
  }

  async findBySlug(slug: string): Promise<EventEntity | null> {
    const row = await this.prisma.event.findUnique({ where: { slug } });
    return row ? this.map(row) : null;
  }

  private accessibleWhere(userId: string) {
    return {
      OR: [{ ownerId: userId }, { collaborators: { some: { profileId: userId } } }],
    };
  }

  async findAllByOwner(ownerId: string): Promise<EventEntity[]> {
    const rows = await this.prisma.event.findMany({
      where: this.accessibleWhere(ownerId),
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.map(r));
  }

  async findAllByOwnerPaginated(
    ownerId: string,
    pagination: { skip: number; take: number },
    folderId?: string | null,
  ): Promise<{ data: EventWithMyRole[]; total: number }> {
    const where = {
      ...this.accessibleWhere(ownerId),
      ...(folderId !== undefined && { folderId }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        // O vínculo do próprio usuário vem no mesmo join que já filtra a lista:
        // é o que dá o `myRole` de cada card sem uma consulta por evento.
        include: { collaborators: { where: { profileId: ownerId }, select: { role: true } } },
        // `order` é a posição manual do drag & drop; createdAt desempata e
        // mantém o comportamento antigo para quem nunca reordenou (tudo em 0).
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.event.count({ where }),
    ]);
    return { data: rows.map((r) => this.withMyRole(r, ownerId)), total };
  }

  /** Mesma regra do findOwnershipById: dono é admin implícito. */
  private withMyRole(
    row: EventRow & { collaborators?: Array<{ role: EventRole }> },
    userId: string,
  ): EventWithMyRole {
    const role: EventRole =
      row.ownerId === userId ? 'admin' : (row.collaborators?.[0]?.role ?? 'read');
    return Object.assign(this.map(row), { myRole: role });
  }

  async reorder(ownerId: string, folderId: string | null, ids: string[]): Promise<void> {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.event.updateMany({
          where: { id, folderId, ...this.accessibleWhere(ownerId) },
          data: { order: index },
        }),
      ),
    );
  }

  // O front arrasta com a página que tem na mão e manda só dois ids; a
  // sequência do escopo inteiro é lida aqui, e só as linhas cujo `order` mudou
  // são escritas.
  async move(ownerId: string, id: string, beforeId?: string): Promise<boolean> {
    const item = await this.prisma.event.findFirst({
      where: { id, ...this.accessibleWhere(ownerId) },
      select: { folderId: true },
    });
    if (!item) return false;

    const rows = await this.prisma.event.findMany({
      where: { folderId: item.folderId, ...this.accessibleWhere(ownerId) },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, order: true },
    });
    if (beforeId && !rows.some((r) => r.id === beforeId)) return false;

    const sequence = resequence(
      rows.map((r) => r.id),
      id,
      beforeId,
    );
    await this.prisma.$transaction(
      writesFor(rows, sequence).map(({ id: rowId, order }) =>
        this.prisma.event.update({ where: { id: rowId }, data: { order } }),
      ),
    );
    return true;
  }

  async create(data: CreateEventData): Promise<EventEntity> {
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const suffix = randomBytes(3).toString('hex').toUpperCase();
      const slug = EventEntity.generateSlug(data.title, suffix);
      try {
        const row = await this.prisma.event.create({ data: { ...data, slug } });
        return this.map(row);
      } catch (err: any) {
        if (err?.code === 'P2002' && attempt < MAX_RETRIES - 1) continue;
        throw err;
      }
    }
    throw new Error('Failed to generate unique slug after multiple attempts');
  }

  async update(id: string, data: UpdateEventData): Promise<EventEntity> {
    const row = await this.prisma.event.update({ where: { id }, data });
    return this.map(row);
  }

  async updateStatus(id: string, status: EventStatus, editorId?: string): Promise<EventEntity> {
    const row = await this.prisma.event.update({
      where: { id },
      data: { status, ...(editorId ? { lastEditedById: editorId } : {}) },
    });
    return this.map(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.event.delete({ where: { id } });
  }

  async findOwnershipById(id: string, profileId: string): Promise<EventOwnership | null> {
    const event = await this.prisma.event.findUnique({
      where: { id },
      select: {
        ownerId: true,
        collaborators: { where: { profileId }, select: { id: true, role: true }, take: 1 },
      },
    });
    if (!event) return null;
    const collaborator = event.collaborators[0];
    return {
      ownerId: event.ownerId,
      isCollaborator: collaborator !== undefined,
      // O dono é admin implícito; quem não tem vínculo nenhum não tem papel.
      role: event.ownerId === profileId ? 'admin' : collaborator ? collaborator.role : null,
    };
  }

  async findWhatsappInstanceToken(id: string): Promise<string | null> {
    const event = await this.prisma.event.findUnique({
      where: { id },
      select: { whatsappInstance: { select: { token: true } } },
    });
    return event?.whatsappInstance?.token ?? null;
  }

  async findDuplicationSource(id: string): Promise<EventDuplicationSource | null> {
    const row = await this.prisma.event.findUnique({
      where: { id },
      include: {
        folder: { select: { ownerId: true } },
        forms: { include: { fields: true } },
        messageTemplates: true,
        automationRules: {
          include: {
            template: true,
            forms: { include: { form: { select: { slug: true } } } },
          },
        },
      },
    });
    if (!row) return null;

    // Templates do evento ∪ os referenciados por regra de fora dele (globais ou
    // de outro evento) — o Map dedupla por id, então um template do evento já
    // presente em `messageTemplates` só é reescrito com o mesmo valor.
    const templatesById = new Map<string, (typeof row.messageTemplates)[number]>();
    for (const template of row.messageTemplates) templatesById.set(template.id, template);
    for (const rule of row.automationRules) templatesById.set(rule.template.id, rule.template);

    return {
      title: row.title,
      location: row.location,
      capacity: row.capacity,
      dressCode: row.dressCode,
      groupLink: row.groupLink,
      eventDate: row.eventDate,
      endDate: row.endDate,
      folderId: row.folderId,
      folderOwnerId: row.folder?.ownerId ?? null,
      forms: row.forms.map((form) => ({
        name: form.name,
        slug: form.slug,
        order: form.order,
        description: form.description,
        postRegistrationMessage: form.postRegistrationMessage,
        linkPostSubscription: form.linkPostSubscription,
        sendToPipedrive: form.sendToPipedrive,
        fields: form.fields.map((f) => ({
          label: f.label,
          type: f.type,
          required: f.required,
          options: f.options,
          order: f.order,
          isFixed: f.isFixed,
        })),
      })),
      templates: [...templatesById.values()].map((t) => ({
        sourceId: t.id,
        name: t.name,
        channel: t.channel,
        subject: t.subject,
        body: t.body,
        layoutConfig:
          t.layoutConfig && typeof t.layoutConfig === 'object'
            ? (t.layoutConfig as Record<string, unknown>)
            : null,
        styleKey: t.styleKey,
        attachment:
          t.attachment && typeof t.attachment === 'object'
            ? (t.attachment as unknown as StoredAttachment)
            : null,
        order: t.order,
      })),
      automationRules: row.automationRules.map((a) => ({
        templateId: a.templateId,
        trigger: a.trigger,
        delayMinutes: a.delayMinutes,
        cron: a.cron,
        timezone: a.timezone,
        sendAt: a.sendAt,
        sendTime: a.sendTime,
        name: a.name,
        active: a.active,
        order: a.order,
        formSlugs: a.forms.map((f) => f.form.slug),
      })),
    };
  }

  /**
   * Evento + formulários + templates + regras numa única transação: os ids
   * novos (`formId`, `templateId`) só existem depois do `create` de cada peça,
   * então o remapeamento (`sourceTemplateId → novoId`, `formSlug → novoFormId`)
   * acontece aqui dentro, não no service.
   */
  async createDuplicateGraph(
    data: CreateDuplicateEventGraphData,
  ): Promise<CreateDuplicateEventGraphResult> {
    return this.prisma.$transaction(async (tx) => {
      const eventRow = await tx.event.create({
        data: {
          ownerId: data.event.ownerId,
          title: data.event.title,
          slug: data.event.slug,
          location: data.event.location,
          capacity: data.event.capacity,
          dressCode: data.event.dressCode,
          groupLink: data.event.groupLink,
          eventDate: data.event.eventDate,
          endDate: data.event.endDate,
          lastEditedById: data.event.lastEditedById,
          folderId: data.event.folderId,
          status: 'draft',
        },
      });

      // `createWithFields` de antes preservava o slug do formulário original;
      // aqui o mapa nasce junto com a criação, no mesmo lugar.
      const formIdBySlug = new Map<string, string>();
      for (const form of data.forms) {
        const formRow = await tx.form.create({
          data: {
            eventId: eventRow.id,
            name: form.name,
            slug: form.slug,
            order: form.order,
            description: form.description,
            postRegistrationMessage: form.postRegistrationMessage,
            linkPostSubscription: form.linkPostSubscription,
            sendToPipedrive: form.sendToPipedrive,
            fields: {
              create: form.fields.map((f) => ({
                label: f.label,
                type: f.type as Prisma.FormFieldUncheckedCreateInput['type'],
                required: f.required,
                options: f.options ?? undefined,
                order: f.order,
                isFixed: f.isFixed,
              })),
            },
          },
        });
        formIdBySlug.set(formRow.slug, formRow.id);
      }

      const templateIdBySourceId = new Map<string, string>();
      for (const template of data.templates) {
        const templateRow = await tx.messageTemplate.create({
          data: {
            ownerId: data.event.ownerId,
            name: template.name,
            channel: template.channel,
            subject: template.subject,
            body: template.body,
            layoutConfig:
              template.layoutConfig != null
                ? (template.layoutConfig as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            styleKey: template.styleKey,
            attachment:
              template.attachment != null
                ? (template.attachment as unknown as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            eventId: eventRow.id,
            folderId: null,
            order: template.order,
          },
        });
        templateIdBySourceId.set(template.sourceId, templateRow.id);
      }

      const createdRules: CreateDuplicateEventGraphResult['rules'] = [];
      for (const rule of data.rules) {
        const templateId = templateIdBySourceId.get(rule.templateId);
        // Não deveria acontecer: `findDuplicationSource` garante que todo
        // template referenciado por uma regra está em `templates`.
        if (!templateId) {
          throw new Error(`Duplication template not found for source template ${rule.templateId}`);
        }
        const formIds = rule.formSlugs
          .map((slug) => formIdBySlug.get(slug))
          .filter((formId): formId is string => formId !== undefined);
        const ruleRow = await tx.automationRule.create({
          data: {
            eventId: eventRow.id,
            templateId,
            trigger: rule.trigger as Prisma.AutomationRuleUncheckedCreateInput['trigger'],
            delayMinutes: rule.delayMinutes ?? undefined,
            cron: rule.cron ?? undefined,
            timezone: rule.timezone ?? undefined,
            sendAt: rule.sendAt ?? undefined,
            sendTime: rule.sendTime ?? undefined,
            name: rule.name ?? undefined,
            order: rule.order,
            active: rule.active,
            ...(formIds.length && { forms: { create: formIds.map((formId) => ({ formId })) } }),
          },
        });
        createdRules.push({
          id: ruleRow.id,
          trigger: ruleRow.trigger,
          cron: ruleRow.cron,
          timezone: ruleRow.timezone,
          active: ruleRow.active,
        });
      }

      return {
        event: {
          id: eventRow.id,
          ownerId: eventRow.ownerId,
          title: eventRow.title,
          slug: eventRow.slug,
        },
        rules: createdRules,
      };
    });
  }

  findPublicBySlug(slug: string): Promise<PublicEventSummary | null> {
    return this.prisma.event.findUnique({ where: { slug }, select: PUBLIC_EVENT_SELECT });
  }

  async findAutomationContext(id: string): Promise<EventAutomationContext | null> {
    const row = await this.prisma.event.findUnique({
      where: { id },
      include: { whatsappInstance: true },
    });
    if (!row) return null;
    return {
      id: row.id,
      ownerId: row.ownerId,
      title: row.title,
      status: row.status,
      eventDate: row.eventDate,
      location: row.location,
      capacity: row.capacity,
      dressCode: row.dressCode,
      groupLink: row.groupLink,
      whatsappToken: row.whatsappInstance?.token ?? null,
    };
  }

  async findWithApprovedRegistrationIds(
    id: string,
    formIds?: string[],
  ): Promise<{ id: string; registrationIds: string[] } | null> {
    const row = await this.prisma.event.findUnique({
      where: { id },
      include: {
        registrations: {
          where: {
            status: 'approved',
            ...(formIds?.length && { formResponses: { some: { formId: { in: formIds } } } }),
          },
          select: { id: true },
        },
      },
    });
    if (!row) return null;
    return { id: row.id, registrationIds: row.registrations.map((r) => r.id) };
  }
}
