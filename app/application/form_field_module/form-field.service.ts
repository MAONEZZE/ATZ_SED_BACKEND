import { Inject, Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { FieldType, FormFieldEntity } from '@domain/form_field_module/form-field.entity';
import {
  FORM_FIELD_REPOSITORY_PORT,
  FormFieldRepositoryPort,
} from '@domain/form_field_module/i-repository-form-field';
import { FormService } from '@application/form_module/form.service';
import { EventService } from '@application/event_module/event.service';

export interface CreateFormFieldInput {
  label: string;
  type: string;
  required?: boolean;
  options?: unknown;
  order?: number;
  /** Formulário do evento onde o campo entra. */
  formId: string;
}

export interface UpdateFormFieldInput {
  label?: string;
  type?: string;
  required?: boolean;
  options?: unknown;
  order?: number;
}

@Injectable()
export class FormFieldService {
  private readonly logger = new Logger(FormFieldService.name);

  constructor(
    @Inject(FORM_FIELD_REPOSITORY_PORT)
    private readonly repo: FormFieldRepositoryPort,
    private readonly eventsService: EventService,
    private readonly formsService: FormService,
  ) {}

  listPaginated(eventId: string, formId: string | undefined, page: number, limit: number) {
    return this.repo.findAllByEventPaginated(eventId, formId, {
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  /** Rótulos na ordem de exibição — cabeçalho de coluna no CSV. */
  exportLabels(formId: string, onlyDynamic = false) {
    return this.repo.listLabels(formId, onlyDynamic);
  }

  /** Metadados para validar as respostas enviadas. */
  validationFields(formId: string) {
    return this.repo.listValidationFields(formId);
  }

  /** Campos como o formulário público os renderiza. */
  publicFields(formId: string) {
    return this.repo.listPublicByForm(formId);
  }

  async create(eventId: string, editorId: string, input: CreateFormFieldInput) {
    await this.assertEventEditable(eventId);
    // O formulário é escolhido explicitamente: sem os 3 tipos fixos não existe
    // mais "o form padrão" para materializar na hora.
    const form = await this.formsService.findOne(input.formId, eventId);
    const field = await this.repo.create({
      formId: form.id,
      label: input.label,
      type: input.type as FieldType,
      required: input.required ?? true,
      options: input.options,
      order: input.order ?? 99,
      isFixed: false,
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
      ...(input.type !== undefined && { type: input.type as FieldType }),
      ...(input.required !== undefined && { required: input.required }),
      ...(input.options !== undefined && { options: input.options }),
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
    const isOptionsBased = FormFieldEntity.isOptionsBased(nextType ?? '');
    const hasUsableOptions = FormFieldEntity.hasUsableOptions(nextOptions);

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
}
