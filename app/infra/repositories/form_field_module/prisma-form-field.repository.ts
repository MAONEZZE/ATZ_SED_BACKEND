import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaRepositoryBase } from '@infra/repositories/shared/prisma-repository.base';
import { FieldType, FormFieldEntity } from '@domain/form_field_module/form-field.entity';
import {
  CreateFormFieldData,
  FormFieldLabel,
  FormFieldRepositoryPort,
  FormFieldValidationRule,
  PublicFormField,
  UpdateFormFieldData,
} from '@domain/form_field_module/i-repository-form-field';

type FormFieldRow = {
  id: string;
  formId: string;
  label: string;
  type: string;
  required: boolean;
  options: Prisma.JsonValue;
  order: number;
  isFixed: boolean;
  createdAt: Date;
};

@Injectable()
export class PrismaFormFieldRepository
  extends PrismaRepositoryBase
  implements FormFieldRepositoryPort
{
  private toEntity(row: FormFieldRow): FormFieldEntity {
    return new FormFieldEntity(
      row.id,
      row.formId,
      row.label,
      row.type as FieldType,
      row.required,
      row.options,
      row.order,
      row.isFixed,
      row.createdAt,
    );
  }

  /** `undefined`/`null` gravam JSON null: um campo sem opções é o caso normal. */
  private toJson(options: unknown) {
    return options != null ? (options as Prisma.InputJsonValue) : Prisma.JsonNull;
  }

  async findAllByEventPaginated(
    eventId: string,
    formId: string | undefined,
    pagination: { skip: number; take: number },
  ): Promise<{ data: FormFieldEntity[]; total: number }> {
    const where = { form: { eventId }, ...(formId ? { formId } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.formField.findMany({
        where,
        orderBy: { order: 'asc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.formField.count({ where }),
    ]);
    return { data: rows.map((row) => this.toEntity(row)), total };
  }

  async findByEvent(eventId: string, id: string): Promise<FormFieldEntity | null> {
    const row = await this.prisma.formField.findFirst({ where: { id, form: { eventId } } });
    return row ? this.toEntity(row) : null;
  }

  findByEventAndType(
    eventId: string,
    type: string,
    excludeId?: string,
  ): Promise<{ id: string; formId: string; label: string } | null> {
    return this.prisma.formField.findFirst({
      where: {
        form: { eventId },
        type: type as FieldType,
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true, formId: true, label: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  findByFormAndType(
    formId: string,
    type: string,
    excludeId?: string,
  ): Promise<{ id: string; formId: string; label: string } | null> {
    return this.prisma.formField.findFirst({
      where: {
        formId,
        type: type as FieldType,
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true, formId: true, label: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Rótulos do formulário na ordem, opcionalmente só os dinâmicos — cabeçalho do CSV. */
  listLabels(formId: string, onlyDynamic = false): Promise<FormFieldLabel[]> {
    return this.prisma.formField.findMany({
      where: { formId, ...(onlyDynamic ? { isFixed: false } : {}) },
      orderBy: { order: 'asc' },
      select: { id: true, label: true },
    });
  }

  /** Metadados para validar as respostas enviadas. */
  listValidationFields(formId: string): Promise<FormFieldValidationRule[]> {
    return this.prisma.formField.findMany({
      where: { formId },
      select: { id: true, label: true, type: true, required: true, isFixed: true, options: true },
    });
  }

  async create(data: CreateFormFieldData): Promise<FormFieldEntity> {
    const row = await this.prisma.formField.create({
      data: {
        formId: data.formId,
        label: data.label,
        type: data.type,
        required: data.required,
        options: this.toJson(data.options),
        order: data.order,
        isFixed: data.isFixed,
      },
    });
    return this.toEntity(row);
  }

  async update(id: string, data: UpdateFormFieldData): Promise<FormFieldEntity> {
    const payload: Prisma.FormFieldUncheckedUpdateInput = {
      ...(data.label !== undefined && { label: data.label }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.required !== undefined && { required: data.required }),
      ...(data.options !== undefined && { options: this.toJson(data.options) }),
      ...(data.order !== undefined && { order: data.order }),
    };
    const row = await this.prisma.formField.update({ where: { id }, data: payload });
    return this.toEntity(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.formField.delete({ where: { id } });
  }

  /** Stamps the last editor on the parent event (event + its form scope). */
  async touchEvent(eventId: string, userId: string): Promise<void> {
    await this.prisma.event.update({ where: { id: eventId }, data: { lastEditedById: userId } });
  }

  /** Lista pública (sem auth) dos campos do formulário, na ordem de renderização. */
  listPublicByForm(formId: string): Promise<PublicFormField[]> {
    return this.prisma.formField.findMany({
      where: { formId },
      orderBy: { order: 'asc' },
      select: { id: true, label: true, type: true, required: true, options: true, order: true },
    });
  }
}
