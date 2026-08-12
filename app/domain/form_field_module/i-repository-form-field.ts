import { FormKind } from '@domain/shared/form-kind.type';
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

/**
 * Validação do envio público. Sem `isFixed`: o formulário público valida todos
 * os campos igual, não distingue fixo de dinâmico.
 */
export interface PublicFormFieldValidationRule {
  label: string;
  type: string;
  required: boolean;
  options: unknown;
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
  findAllByEventPaginated(
    eventId: string,
    kind: FormKind | undefined,
    pagination: { skip: number; take: number },
  ): Promise<{ data: FormFieldEntity[]; total: number }>;

  /** Resolve pelo evento, e não só pelo id, para não alcançar campo de outro evento. */
  findByEvent(eventId: string, id: string): Promise<FormFieldEntity | null>;

  listLabels(eventId: string, kind: FormKind, onlyDynamic?: boolean): Promise<FormFieldLabel[]>;

  listValidationFields(eventId: string, kind: FormKind): Promise<FormFieldValidationRule[]>;

  create(data: CreateFormFieldData): Promise<FormFieldEntity>;
  update(id: string, data: UpdateFormFieldData): Promise<FormFieldEntity>;
  delete(id: string): Promise<void>;

  /** Carimba o último editor no evento pai (evento + o escopo de formulário). */
  touchEvent(eventId: string, userId: string): Promise<void>;

  listPublicByEventAndKind(eventId: string, kind: FormKind): Promise<PublicFormField[]>;

  /** Validação de envio público, resolvida direto pelo slug do evento. */
  listValidationFieldsBySlug(
    slug: string,
    kind: FormKind,
  ): Promise<PublicFormFieldValidationRule[]>;
}
