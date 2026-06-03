import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '@database/prisma/prisma.service';
import {
  EventRepositoryPort,
  CreateEventData,
  UpdateEventData,
} from '@domain/events/ports/event-repository.port';
import { EventEntity, EventStatus } from '@domain/events/entities/event.entity';

@Injectable()
export class PrismaEventRepository implements EventRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  private map(row: {
    id: string;
    ownerId: string;
    title: string;
    slug: string;
    status: string;
    description: string | null;
    coverUrl: string | null;
    location: string | null;
    capacity: number | null;
    dressCode: string | null;
    groupLink: string | null;
    eventDate: Date | null;
    evolutionInstance: string | null;
    evolutionToken: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): EventEntity {
    return new EventEntity(
      row.id,
      row.ownerId,
      row.title,
      row.slug,
      row.status as EventStatus,
      row.description ?? undefined,
      row.coverUrl ?? undefined,
      row.location ?? undefined,
      row.capacity ?? undefined,
      row.dressCode ?? undefined,
      row.groupLink ?? undefined,
      row.eventDate ?? undefined,
      row.evolutionInstance ?? undefined,
      row.evolutionToken ?? undefined,
      row.createdAt,
      row.updatedAt,
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

  async findAllByOwner(ownerId: string): Promise<EventEntity[]> {
    const rows = await this.prisma.event.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.map(r));
  }

  async create(data: CreateEventData): Promise<EventEntity> {
    const FIXED_FIELDS = [
      { label: 'Nome', type: 'text' as const, required: true, isFixed: true, order: 0 },
      { label: 'Telefone', type: 'phone' as const, required: true, isFixed: true, order: 1 },
      { label: 'E-mail', type: 'email' as const, required: true, isFixed: true, order: 2 },
      { label: 'Endereço', type: 'text' as const, required: false, isFixed: true, order: 3 },
    ] as const;

    const LANDING_SECTIONS = [
      { type: 'hero', order: 0, enabled: true },
      { type: 'about', order: 1, enabled: true },
      { type: 'registration', order: 2, enabled: true },
      { type: 'speakers', order: 3, enabled: false },
      { type: 'schedule', order: 4, enabled: false },
      { type: 'venue', order: 5, enabled: false },
      { type: 'faq', order: 6, enabled: false },
      { type: 'gallery', order: 7, enabled: false },
      { type: 'testimonials', order: 8, enabled: false },
      { type: 'sponsors', order: 9, enabled: false },
    ];

    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const suffix = randomBytes(3).toString('hex').toUpperCase();
      const slug = EventEntity.generateSlug(data.title, suffix);
      try {
        const row = await this.prisma.$transaction(async (tx) => {
          const event = await tx.event.create({ data: { ...data, slug } });
          await tx.formField.createMany({
            data: FIXED_FIELDS.map((f) => ({ ...f, eventId: event.id })),
          });
          await tx.landingPage.create({
            data: {
              eventId: event.id,
              sections: { create: LANDING_SECTIONS },
            },
          });
          return event;
        });
        return this.map(row);
      } catch (err: any) {
        // P2002: unique constraint violation — slug collision, retry
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

  async updateStatus(id: string, status: EventStatus): Promise<EventEntity> {
    const row = await this.prisma.event.update({
      where: { id },
      data: { status },
    });
    return this.map(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.event.delete({ where: { id } });
  }
}
