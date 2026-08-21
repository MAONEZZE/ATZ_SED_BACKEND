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

/** Rótulo, na ordem de exibição — vira cabeçalho de coluna no CSV. `id` é a chave real dos `answers`. */
export interface FormFieldLabel {
  id: string;
  label: string;
}

/**
 * Metadados para validar uma resposta enviada por quem edita o evento. Traz
 * `isFixed` porque campos fixos (nome/e-mail/telefone) são tratados à parte na
 * validação. `id` é a chave canônica de `answers`.
 */
export interface FormFieldValidationRule {
  id: string;
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

  /**
   * Campo do evento com o `type` dado (join com `forms`, que é quem carrega
   * `event_id`). `excludeId` ignora o próprio campo — usado no `update`, para
   * não colidir com ele mesmo. `orderBy: createdAt asc` faz a corrida de 2
   * criações simultâneas convergir sempre no mesmo campo.
   */
  findByEventAndType(
    eventId: string,
    type: string,
    excludeId?: string,
  ): Promise<{ id: string; formId: string; label: string } | null>;

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
