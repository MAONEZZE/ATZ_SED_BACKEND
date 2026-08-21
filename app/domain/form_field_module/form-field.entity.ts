import { EntityBase } from '@domain/shared/entity.base';

/** Tipos de campo aceitos no formulário, espelhando o enum `FieldType` do banco. */
export const FIELD_TYPES = [
  'text',
  'textarea',
  'email',
  'phone',
  'select',
  'multiselect',
  'checkbox',
  'image',
  'date',
  'linkedin',
  'instagram',
  'on_date_automation_field',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/**
 * Um campo de um escopo de formulário. `isFixed` marca os campos que a
 * plataforma cria e o usuário não pode remover (nome, e-mail, telefone); os
 * demais são dinâmicos e entram nas colunas do CSV.
 *
 * Campos públicos com o nome das colunas: a listagem paginada é serializada
 * direto como corpo da resposta.
 */
export class FormFieldEntity extends EntityBase {
  constructor(
    id: string,
    public readonly formId: string,
    public readonly label: string,
    public readonly type: FieldType,
    public readonly required: boolean,
    public readonly options: unknown,
    public readonly order: number,
    public readonly isFixed: boolean,
    public readonly createdAt: Date,
  ) {
    super(id);
  }

  /** Tipos cuja resposta só faz sentido contra uma lista de opções. */
  static isOptionsBased(type: string): boolean {
    return type === 'select' || type === 'multiselect';
  }

  /**
   * Um campo de escolha sem opções não tem como ser respondido. Vale para o
   * campo atual e para o resultado de uma edição de tipo.
   */
  static hasUsableOptions(options: unknown): boolean {
    return Array.isArray(options) && options.length > 0;
  }

  isOptionsBased(): boolean {
    return FormFieldEntity.isOptionsBased(this.type);
  }
}
