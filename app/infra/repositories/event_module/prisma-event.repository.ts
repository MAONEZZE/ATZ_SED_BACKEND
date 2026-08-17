import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '@infra/prisma/prisma.service';
import {
  EventRepositoryPort,
  CreateEventData,
  UpdateEventData,
  EventOwnership,
  EventDuplicationSource,
  CreateDuplicateEventData,
  CreatedDuplicateEvent,
  PublicEventSummary,
  EventAutomationContext,
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
  sendToPipedrive: true,
  status: true,
} as const;
import { EventEntity, EventStatus } from '@domain/event_module/event.entity';

@Injectable()
export class PrismaEventRepository implements EventRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  private map(row: {
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
    sendToPipedrive: boolean;
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
  }): EventEntity {
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
      row.sendToPipedrive,
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
  ): Promise<{ data: EventEntity[]; total: number }> {
    const where = {
      ...this.accessibleWhere(ownerId),
      ...(folderId !== undefined && { folderId }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        // `order` é a posição manual do drag & drop; createdAt desempata e
        // mantém o comportamento antigo para quem nunca reordenou (tudo em 0).
        orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.event.count({ where }),
    ]);
    return { data: rows.map((r) => this.map(r)), total };
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
        collaborators: { where: { profileId }, select: { id: true }, take: 1 },
      },
    });
    if (!event) return null;
    return { ownerId: event.ownerId, isCollaborator: event.collaborators.length > 0 };
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
      include: { forms: { include: { fields: true } }, automationRules: true },
    });
    if (!row) return null;
    return {
      title: row.title,
      location: row.location,
      capacity: row.capacity,
      dressCode: row.dressCode,
      groupLink: row.groupLink,
      eventDate: row.eventDate,
      endDate: row.endDate,
      sendToPipedrive: row.sendToPipedrive,
      forms: row.forms.map((form) => ({
        kind: form.kind,
        description: form.description,
        postRegistrationMessage: form.postRegistrationMessage,
        linkPostSubscription: form.linkPostSubscription,
        fields: form.fields.map((f) => ({
          label: f.label,
          type: f.type,
          required: f.required,
          options: f.options,
          order: f.order,
          isFixed: f.isFixed,
        })),
      })),
      automationRules: row.automationRules.map((a) => ({
        templateId: a.templateId,
        trigger: a.trigger,
        delayMinutes: a.delayMinutes,
        active: a.active,
      })),
    };
  }

  async createDuplicate(data: CreateDuplicateEventData): Promise<CreatedDuplicateEvent> {
    const row = await this.prisma.event.create({
      data: { ...data, status: 'draft' },
    });
    return { id: row.id, ownerId: row.ownerId, title: row.title, slug: row.slug };
  }

  findPublicBySlug(slug: string): Promise<PublicEventSummary | null> {
    return this.prisma.event.findUnique({ where: { slug }, select: PUBLIC_EVENT_SELECT });
  }

  findStatusBySlug(slug: string): Promise<{ id: string; status: EventStatus } | null> {
    return this.prisma.event.findUnique({ where: { slug }, select: { id: true, status: true } });
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
  ): Promise<{ id: string; registrationIds: string[] } | null> {
    const row = await this.prisma.event.findUnique({
      where: { id },
      include: { registrations: { where: { status: 'approved' }, select: { id: true } } },
    });
    if (!row) return null;
    return { id: row.id, registrationIds: row.registrations.map((r) => r.id) };
  }
}
