import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@database/prisma/prisma.service';
import {
  UserSubscriptionRepositoryPort,
  UserSubscriptionRow,
  UpsertContact,
  FormKind,
} from '@domain/registrations/ports/user-subscription-repository.port';

const ANSWERS_COLUMN: Record<FormKind, 'registrationAnswers' | 'postEventAnswers' | 'npsAnswers'> = {
  registration: 'registrationAnswers',
  post_event: 'postEventAnswers',
  nps: 'npsAnswers',
};

type Row = {
  id: string;
  eventId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  registrationAnswers: unknown;
  postEventAnswers: unknown;
  npsAnswers: unknown;
};

@Injectable()
export class PrismaUserSubscriptionRepository implements UserSubscriptionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  private map(row: Row): UserSubscriptionRow {
    return {
      id: row.id,
      eventId: row.eventId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      registrationAnswers: row.registrationAnswers as Record<string, unknown> | null,
      postEventAnswers: row.postEventAnswers as Record<string, unknown> | null,
      npsAnswers: row.npsAnswers as Record<string, unknown> | null,
    };
  }

  async findByEventAndContact(
    eventId: string,
    contact: { email?: string; phone?: string },
  ): Promise<UserSubscriptionRow | null> {
    if (contact.email) {
      const row = await this.prisma.userSubscription.findFirst({
        where: { eventId, email: { equals: contact.email, mode: 'insensitive' } },
      });
      if (row) return this.map(row);
    }
    if (contact.phone) {
      const digits = contact.phone.replace(/\D/g, '');
      if (!digits) return null;
      const rows = await this.prisma.userSubscription.findMany({ where: { eventId } });
      const match = rows.find((r) => (r.phone ?? '').replace(/\D/g, '') === digits);
      return match ? this.map(match) : null;
    }
    return null;
  }

  async create(data: {
    eventId: string;
    contact: UpsertContact;
    kind: FormKind;
    answers: Record<string, unknown>;
  }): Promise<UserSubscriptionRow> {
    const row = await this.prisma.userSubscription.create({
      data: {
        eventId: data.eventId,
        name: data.contact.name ?? null,
        email: data.contact.email ?? null,
        phone: data.contact.phone ?? null,
        [ANSWERS_COLUMN[data.kind]]: data.answers as Prisma.InputJsonValue,
      },
    });
    return this.map(row);
  }

  async update(
    id: string,
    data: { contact: UpsertContact; kind: FormKind; answers: Record<string, unknown> },
  ): Promise<UserSubscriptionRow> {
    const current = await this.prisma.userSubscription.findUniqueOrThrow({ where: { id } });
    const row = await this.prisma.userSubscription.update({
      where: { id },
      data: {
        // Only fill missing contact fields; never overwrite an existing value.
        name: current.name ?? data.contact.name ?? null,
        email: current.email ?? data.contact.email ?? null,
        phone: current.phone ?? data.contact.phone ?? null,
        [ANSWERS_COLUMN[data.kind]]: data.answers as Prisma.InputJsonValue,
      },
    });
    return this.map(row);
  }
}
