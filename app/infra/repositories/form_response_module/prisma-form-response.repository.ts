import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaRepositoryBase } from '@infra/repositories/shared/prisma-repository.base';
import { FormResponseEntity } from '@domain/form_response_module/form-response.entity';
import {
  FormResponseRepositoryPort,
  FormResponseWithContext,
  UpsertFormResponseData,
} from '@domain/form_response_module/i-repository-form-response';

type ResponseRow = {
  id: string;
  formId: string;
  eventId: string;
  registrationId: string;
  answers: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

type ResponseRowWithJoins = ResponseRow & {
  form: { name: string };
  registration: { name: string; email: string; phone: string };
};

@Injectable()
export class PrismaFormResponseRepository
  extends PrismaRepositoryBase
  implements FormResponseRepositoryPort
{
  private toEntity(row: ResponseRow): FormResponseEntity {
    return new FormResponseEntity(
      row.id,
      row.formId,
      row.eventId,
      row.registrationId,
      (row.answers ?? {}) as Record<string, unknown>,
      row.createdAt,
      row.updatedAt,
    );
  }

  private toContext(row: ResponseRowWithJoins): FormResponseWithContext {
    return {
      id: row.id,
      formId: row.formId,
      formName: row.form.name,
      registrationId: row.registrationId,
      name: row.registration.name,
      email: row.registration.email,
      phone: row.registration.phone,
      answers: (row.answers ?? {}) as Record<string, unknown>,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private readonly joins = {
    form: { select: { name: true } },
    registration: { select: { name: true, email: true, phone: true } },
  } as const;

  async upsert(data: UpsertFormResponseData): Promise<FormResponseEntity> {
    const row = await this.prisma.formResponse.upsert({
      where: {
        formId_registrationId: { formId: data.formId, registrationId: data.registrationId },
      },
      create: {
        formId: data.formId,
        eventId: data.eventId,
        registrationId: data.registrationId,
        answers: data.answers as Prisma.InputJsonValue,
      },
      update: { answers: data.answers as Prisma.InputJsonValue },
    });
    return this.toEntity(row);
  }

  async findAllByEvent(eventId: string, formId?: string): Promise<FormResponseWithContext[]> {
    const rows = await this.prisma.formResponse.findMany({
      where: { eventId, ...(formId && { formId }) },
      include: this.joins,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toContext(row));
  }

  async findAllByEventPaginated(
    eventId: string,
    pagination: { skip: number; take: number },
    formId?: string,
  ): Promise<{ data: FormResponseWithContext[]; total: number }> {
    const where = { eventId, ...(formId && { formId }) };
    const [rows, total] = await Promise.all([
      this.prisma.formResponse.findMany({
        where,
        include: this.joins,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.formResponse.count({ where }),
    ]);
    return { data: rows.map((row) => this.toContext(row)), total };
  }
}
