import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@database/prisma/prisma.service';
import {
  RegistrationRepositoryPort,
  CreateRegistrationData,
  UpdateAnswersData,
  PostEventResponseData,
} from '@domain/registrations/ports/registration-repository.port';
import {
  RegistrationEntity,
  FunnelStatus,
} from '@domain/registrations/entities/registration.entity';

@Injectable()
export class PrismaRegistrationRepository implements RegistrationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  private map(row: {
    id: string;
    eventId: string;
    status: string;
    answers: unknown;
    name: string;
    email: string;
    phone: string;
    createdAt: Date;
    updatedAt: Date;
  }): RegistrationEntity {
    return new RegistrationEntity(
      row.id,
      row.eventId,
      row.status as FunnelStatus,
      row.answers as Record<string, unknown>,
      row.name,
      row.email,
      row.phone,
      row.createdAt,
      row.updatedAt,
    );
  }

  async findById(id: string): Promise<RegistrationEntity | null> {
    const row = await this.prisma.registration.findUnique({ where: { id } });
    return row ? this.map(row) : null;
  }

  async findAllByEvent(
    eventId: string,
    status?: FunnelStatus,
    search?: string,
  ): Promise<RegistrationEntity[]> {
    const rows = await this.prisma.registration.findMany({
      where: {
        eventId,
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } },
                { phone: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.map(r));
  }

  async findAllByEventPaginated(
    eventId: string,
    pagination: { skip: number; take: number },
    status?: FunnelStatus,
    search?: string,
  ): Promise<{ data: RegistrationEntity[]; total: number }> {
    const where = {
      eventId,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.registration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.registration.count({ where }),
    ]);
    return { data: rows.map((r) => this.map(r)), total };
  }

  async create(data: CreateRegistrationData): Promise<RegistrationEntity> {
    const row = await this.prisma.registration.create({
      data: {
        ...data,
        answers: data.answers as Prisma.InputJsonValue,
        status: 'pending',
      },
    });
    return this.map(row);
  }

  async updateStatus(id: string, status: FunnelStatus): Promise<RegistrationEntity> {
    const row = await this.prisma.registration.update({
      where: { id },
      data: { status },
    });
    return this.map(row);
  }

  async updateAnswers(id: string, data: UpdateAnswersData): Promise<RegistrationEntity> {
    const row = await this.prisma.registration.update({
      where: { id },
      data: {
        answers: data.answers as Prisma.InputJsonValue,
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
      },
    });
    return this.map(row);
  }

  async findByEventAndContact(
    eventId: string,
    contact: { email?: string; phone?: string },
  ): Promise<RegistrationEntity | null> {
    if (contact.email) {
      const row = await this.prisma.registration.findFirst({
        where: { eventId, email: { equals: contact.email, mode: 'insensitive' } },
      });
      return row ? this.map(row) : null;
    }
    if (contact.phone) {
      const digits = contact.phone.replace(/\D/g, '');
      if (!digits) return null;
      const rows = await this.prisma.registration.findMany({ where: { eventId } });
      const match = rows.find((r) => r.phone.replace(/\D/g, '') === digits);
      return match ? this.map(match) : null;
    }
    return null;
  }

  async upsertPostEventResponse(data: PostEventResponseData): Promise<void> {
    await this.prisma.postEventResponse.upsert({
      where: { registrationId: data.registrationId },
      create: {
        eventId: data.eventId,
        registrationId: data.registrationId,
        answers: data.answers as Prisma.InputJsonValue,
      },
      update: { answers: data.answers as Prisma.InputJsonValue },
    });
  }
}
