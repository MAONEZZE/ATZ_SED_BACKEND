import { FieldType, FormFieldEntity } from './form-field.entity';

export const FORM_FIELD_REPOSITORY_PORT = Symbol('FORM_FIELD_REPOSITORY_PORT');

export interface CreateFormFieldData {
  formId: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: unknown;
  order: number;
  isFixed: boolean;
}

/** Chave ausente deixa a coluna intacta. */
export interface UpdateFormFieldData {
  label?: string;
  type?: FieldType;
  required?: boolean;
  options?: unknown;
  order?: number;
}

/** Só o rótulo, na ordem de exibição — vira cabeçalho de coluna no CSV. */
export interface FormFieldLabel {
  label: string;
}

/**
 * Metadados para validar uma resposta enviada por quem edita o evento. Traz
 * `isFixed` porque campos fixos (nome/e-mail/telefone) são tratados à parte na
 * validação.
 */
export interface FormFieldValidationRule {
  label: string;
  type: string;
  required: boolean;
  options: unknown;
  isFixed: boolean;
}

/** Campo como o formulário público o renderiza — sem `isFixed` nem `formId`. */
export interface PublicFormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options: unknown;
  order: number;
}

export interface FormFieldRepositoryPort {
  /** `formId` ausente = todos os campos do evento (qualquer formulário dele). */
  findAllByEventPaginated(
    eventId: string,
    formId: string | undefined,
    pagination: { skip: number; take: number },
  ): Promise<{ data: FormFieldEntity[]; total: number }>;

  /** Resolve pelo evento, e não só pelo id, para não alcançar campo de outro evento. */
  findByEvent(eventId: string, id: string): Promise<FormFieldEntity | null>;

  listLabels(formId: string, onlyDynamic?: boolean): Promise<FormFieldLabel[]>;

  listValidationFields(formId: string): Promise<FormFieldValidationRule[]>;

  create(data: CreateFormFieldData): Promise<FormFieldEntity>;
  update(id: string, data: UpdateFormFieldData): Promise<FormFieldEntity>;
  delete(id: string): Promise<void>;

  /** Carimba o último editor no evento pai (evento + o escopo de formulário). */
  touchEvent(eventId: string, userId: string): Promise<void>;

  /** Campos que o formulário público renderiza, na ordem. */
  listPublicByForm(formId: string): Promise<PublicFormField[]>;
}
