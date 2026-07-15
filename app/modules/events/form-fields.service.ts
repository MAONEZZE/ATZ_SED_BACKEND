import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
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
  type?: string;
  required?: boolean;
  options?: unknown;
  order?: number;
}

@Injectable()
export class FormFieldsService {
  private readonly logger = new Logger(FormFieldsService.name);

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
    const field = await this.assertExists(eventId, id);

    if (input.type !== undefined && input.type !== field.type) {
      this.warnIfTypeChangeIncoherent(field, input);
    }

    const updated = await this.repo.update(id, {
      ...(input.label !== undefined && { label: input.label }),
      ...(input.type !== undefined && { type: input.type as Prisma.FormFieldUncheckedUpdateInput['type'] }),
      ...(input.required !== undefined && { required: input.required }),
      ...(input.options !== undefined && { options: this.toJson(input.options) }),
      ...(input.order !== undefined && { order: input.order }),
    });
    await this.repo.touchEvent(eventId, editorId);
    return updated;
  }

  /**
   * Changing `type` doesn't retroactively revalidate answers already saved
   * under the old type — only new submissions use the new type. Log a
   * warning when the new type is options-based (select/multiselect) but no
   * usable options array is present, since that's the case most likely to
   * silently break new submissions.
   */
  private warnIfTypeChangeIncoherent(
    field: { label: string; type: string; options: unknown },
    input: UpdateFormFieldInput,
  ): void {
    const nextType = input.type;
    const nextOptions = input.options !== undefined ? input.options : field.options;
    const isOptionsBased = nextType === 'select' || nextType === 'multiselect';
    const hasUsableOptions = Array.isArray(nextOptions) && nextOptions.length > 0;

    if (isOptionsBased && !hasUsableOptions) {
      this.logger.warn(
        `Form field "${field.label}" changed to type "${nextType}" without a usable options array; existing answers are not revalidated against the new type.`,
      );
    } else {
      this.logger.warn(
        `Form field "${field.label}" changed type from "${field.type}" to "${nextType}"; existing answers are not revalidated/migrated against the new type.`,
      );
    }
  }

  async delete(eventId: string, id: string, editorId: string): Promise<void> {
    await this.assertEventEditable(eventId);
    await this.assertExists(eventId, id);
    await this.repo.delete(id);
    await this.repo.touchEvent(eventId, editorId);
  }

  private async assertExists(
    eventId: string,
    id: string,
  ): Promise<{ label: string; type: string; options: unknown }> {
    const field = await this.repo.findByEvent(eventId, id);
    if (!field) throw new NotFoundException('Form field not found');
    return field;
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
