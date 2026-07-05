import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FormFieldsRepository, FormFieldKind } from '@modules/events/form-fields.repository';
import { EventsService } from '@modules/events/events.service';

export interface CreateFormFieldInput {
  label: string;
  type: string;
  required?: boolean;
  options?: unknown;
  order?: number;
  kind?: FormFieldKind;
}

export interface UpdateFormFieldInput {
  label?: string;
  required?: boolean;
  options?: unknown;
  order?: number;
}

@Injectable()
export class FormFieldsService {
  constructor(
    private readonly repo: FormFieldsRepository,
    private readonly eventsService: EventsService,
  ) {}

  listPaginated(eventId: string, kind: FormFieldKind | undefined, page: number, limit: number) {
    return this.repo.findAllByEventPaginated(eventId, kind, {
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  /** Ordered labels for CSV export headers (optionally only dynamic fields). */
  exportLabels(eventId: string, kind: FormFieldKind, onlyDynamic = false) {
    return this.repo.listLabels(eventId, kind, onlyDynamic);
  }

  /** Field metadata for validating submitted answers. */
  validationFields(eventId: string, kind: FormFieldKind) {
    return this.repo.listValidationFields(eventId, kind);
  }

  async create(eventId: string, editorId: string, input: CreateFormFieldInput) {
    await this.assertEventEditable(eventId);
    const field = await this.repo.create({
      eventId,
      label: input.label,
      type: input.type as Prisma.FormFieldUncheckedCreateInput['type'],
      required: input.required ?? true,
      options: this.toJson(input.options),
      order: input.order ?? 99,
      isFixed: false,
      kind: (input.kind ?? 'registration') as Prisma.FormFieldUncheckedCreateInput['kind'],
    });
    await this.repo.touchEvent(eventId, editorId);
    return field;
  }

  async update(eventId: string, id: string, editorId: string, input: UpdateFormFieldInput) {
    await this.assertEventEditable(eventId);
    await this.assertExists(eventId, id);
    const updated = await this.repo.update(id, {
      ...(input.label !== undefined && { label: input.label }),
      ...(input.required !== undefined && { required: input.required }),
      ...(input.options !== undefined && { options: this.toJson(input.options) }),
      ...(input.order !== undefined && { order: input.order }),
    });
    await this.repo.touchEvent(eventId, editorId);
    return updated;
  }

  async delete(eventId: string, id: string, editorId: string): Promise<void> {
    await this.assertEventEditable(eventId);
    await this.assertExists(eventId, id);
    await this.repo.delete(id);
    await this.repo.touchEvent(eventId, editorId);
  }

  private async assertExists(eventId: string, id: string): Promise<void> {
    const field = await this.repo.findByEvent(eventId, id);
    if (!field) throw new NotFoundException('Form field not found');
  }

  private async assertEventEditable(eventId: string): Promise<void> {
    const event = await this.eventsService.findById(eventId);
    if (!event.isEditable()) {
      throw new ForbiddenException('Cancelled or ended events cannot be edited');
    }
  }

  private toJson(options: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    return options != null ? (options as Prisma.InputJsonValue) : Prisma.JsonNull;
  }
}
