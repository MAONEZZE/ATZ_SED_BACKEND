import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaRepositoryBase } from '@infra/repositories/shared/prisma-repository.base';
import { FormResponseEntity } from '@domain/form_response_module/form-response.entity';
import {
  FormResponseRepositoryPort,
  FormResponseWithContext,
  UpsertFormResponseData,
} from '@domain/form_response_module/i-repository-form-response';
import { PipedriveStatus } from '@domain/registration_module/registration.entity';

type ResponseRow = {
  id: string;
  formId: string;
  eventId: string;
  registrationId: string | null;
  answers: Prisma.JsonValue;
  pipedriveStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ResponseRowWithJoins = ResponseRow & {
  form: { name: string };
  registration: { name: string; email: string; phone: string } | null;
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
      row.pipedriveStatus as PipedriveStatus | null,
    );
  }

  private toContext(row: ResponseRowWithJoins): FormResponseWithContext {
    return {
      id: row.id,
      formId: row.formId,
      formName: row.form.name,
      registrationId: row.registrationId,
      name: row.registration?.name ?? 'Anônimo',
      email: row.registration?.email ?? '',
      phone: row.registration?.phone ?? '',
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
    // Resposta anônima (registrationId null): where composto com null é inválido
    // no Prisma, e não faz sentido idempotência sem inscrito — sempre cria linha nova.
    if (data.registrationId === null) {
      const row = await this.prisma.formResponse.create({
        data: {
          formId: data.formId,
          eventId: data.eventId,
          registrationId: null,
          answers: data.answers as Prisma.InputJsonValue,
        },
      });
      return this.toEntity(row);
    }

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

  async setPipedriveStatus(id: string, status: PipedriveStatus): Promise<void> {
    await this.prisma.formResponse.update({ where: { id }, data: { pipedriveStatus: status } });
  }

  // `registration: { status: 'approved' }` gera INNER JOIN — resolve de graça o
  // caso de `registrationId` nullable (formulário anônimo): sem inscrito, sem
  // como aprovar, sem como casar no join. Não trocar por SQL cru com LEFT JOIN.
  async findApprovedByForm(
    formId: string,
    pagination: { skip: number; take: number },
  ): Promise<Array<{ registrationId: string; answers: Record<string, unknown> }>> {
    const rows = await this.prisma.formResponse.findMany({
      where: { formId, registration: { status: 'approved' } },
      select: { registrationId: true, answers: true },
      orderBy: { id: 'asc' },
      skip: pagination.skip,
      take: pagination.take,
    });
    return rows.map((row) => ({
      // INNER JOIN acima já garante não-null em runtime; a coluna só é
      // nullable pro caso (sem relação aqui) de formulário anônimo.
      registrationId: row.registrationId as string,
      answers: (row.answers ?? {}) as Record<string, unknown>,
    }));
  }

  async mergeAnswers(
    formId: string,
    registrationId: string,
    partialAnswers: Record<string, unknown>,
  ): Promise<void> {
    if (Object.keys(partialAnswers).length === 0) return;
    await this.prisma.$executeRaw`
      UPDATE "SED"."form_responses"
      SET answers = answers || ${JSON.stringify(partialAnswers)}::jsonb
      WHERE form_id = ${formId} AND registration_id = ${registrationId}
    `;
  }
}
