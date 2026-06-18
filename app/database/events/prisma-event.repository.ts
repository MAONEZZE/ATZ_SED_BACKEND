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
    endDate: Date | null;
    postRegistrationMessage: string | null;
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
      row.endDate ?? undefined,
      row.postRegistrationMessage ?? undefined,
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

  // Eventos acessíveis pelo usuário: dono OU colaborador.
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
  ): Promise<{ data: EventEntity[]; total: number }> {
    const where = this.accessibleWhere(ownerId);
    const [rows, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.event.count({ where }),
    ]);
    return { data: rows.map((r) => this.map(r)), total };
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
