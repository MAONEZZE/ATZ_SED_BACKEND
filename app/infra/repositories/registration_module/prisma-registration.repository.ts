import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaRepositoryBase } from '@infra/repositories/shared/prisma-repository.base';
import { normalizePhone } from '@handlers/phone';
import {
  RegistrationRepositoryPort,
  CreateRegistrationData,
  UpdateAnswersData,
  RegistrationWithEventDate,
} from '@domain/registration_module/i-repository-registration';
import {
  RegistrationEntity,
  FunnelStatus,
  PipedriveStatus,
} from '@domain/registration_module/registration.entity';

@Injectable()
export class PrismaRegistrationRepository
  extends PrismaRepositoryBase
  implements RegistrationRepositoryPort
{
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
    imageAuthorization: boolean;
    attended: boolean;
    pipedriveStatus: string | null;
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
      row.imageAuthorization,
      row.attended,
      row.pipedriveStatus as PipedriveStatus | null,
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
    attended?: boolean,
  ): Promise<RegistrationEntity[]> {
    const rows = await this.prisma.registration.findMany({
      where: {
        eventId,
        ...(status ? { status } : {}),
        ...(attended !== undefined ? { attended } : {}),
        ...this.containsSearch(['name', 'email', 'phone'], search),
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
    attended?: boolean,
  ): Promise<{ data: RegistrationEntity[]; total: number }> {
    const where = {
      eventId,
      ...(status ? { status } : {}),
      ...(attended !== undefined ? { attended } : {}),
      ...this.containsSearch(['name', 'email', 'phone'], search),
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

  // O eventId entra no where junto do id: sem ele um id conhecido apagaria
  // inscrito de outro evento.
  async deleteMany(ids: string[], eventId: string): Promise<number> {
    const { count } = await this.prisma.registration.deleteMany({
      where: { id: { in: ids }, eventId },
    });
    return count;
  }

  async setAttendance(ids: string[], eventId: string, attended: boolean): Promise<number> {
    const { count } = await this.prisma.registration.updateMany({
      where: { id: { in: ids }, eventId },
      data: { attended },
    });
    return count;
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
      const digits = normalizePhone(contact.phone) ?? contact.phone.replace(/\D/g, '');
      if (!digits) return null;
      const rows = await this.prisma.registration.findMany({ where: { eventId } });
      const match = rows.find((r) => (normalizePhone(r.phone) ?? r.phone.replace(/\D/g, '')) === digits);
      return match ? this.map(match) : null;
    }
    return null;
  }

  /**
   * SQL cru porque o filtro precisa normalizar a coluna `phone` no banco: ela
   * tem número com máscara, com e sem `55`, com e sem nono dígito, e o Prisma
   * não expressa `regexp_replace`. Sem isso o `contains` erraria qualquer
   * telefone formatado. O casamento definitivo é em memória (`phoneMatchKey`);
   * aqui só se corta a tabela pelos 8 dígitos finais.
   *
   * A expressão `right(regexp_replace(...), 8)` é literalmente a do índice
   * `registrations_phone_digits_suffix_idx` (migration 20260819...): igualdade,
   * e não `LIKE '%...'`, justamente porque curinga à esquerda não usa índice.
   * Se mexer nesta expressão, mexa no índice também — senão volta a ser scan.
   */
  async findByPhoneWithEventDate(phoneSuffix: string): Promise<RegistrationWithEventDate[]> {
    return this.prisma.$queryRaw<RegistrationWithEventDate[]>`
      SELECT r.id            AS "id",
             r.phone         AS "phone",
             r.event_id      AS "eventId",
             e.title         AS "eventTitle",
             e.slug          AS "eventSlug",
             e.event_date    AS "eventDate"
        FROM "SED".registrations r
        JOIN "SED".events e ON e.id = r.event_id
       WHERE e.event_date IS NOT NULL
         AND right(regexp_replace(r.phone, '[^0-9]', '', 'g'), 8) = ${phoneSuffix}
    `;
  }

  async setPipedriveStatus(id: string, status: PipedriveStatus): Promise<void> {
    await this.prisma.registration.update({ where: { id }, data: { pipedriveStatus: status } });
  }

  countByEvent(eventId: string): Promise<number> {
    return this.prisma.registration.count({ where: { eventId } });
  }

  async findActiveByEvent(eventId: string): Promise<RegistrationEntity[]> {
    const rows = await this.prisma.registration.findMany({
      where: { eventId, status: { in: ['approved', 'pending'] } },
    });
    return rows.map((r) => this.map(r));
  }

  async findByIdsAndEvent(ids: string[], eventId: string): Promise<RegistrationEntity[]> {
    const rows = await this.prisma.registration.findMany({
      where: { id: { in: ids }, eventId },
    });
    return rows.map((r) => this.map(r));
  }
}
