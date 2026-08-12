import { ValidatorBase } from '@domain/shared/validator.base';
import { FormFieldEntity } from './form-field.entity';

export interface FormFieldInput {
  type: string;
  options?: unknown;
}

/** Invariantes de um campo de formulário. */
export class FormFieldValidator extends ValidatorBase<FormFieldInput> {
  validate(input: FormFieldInput): string[] {
    // Um campo de escolha sem lista de opções não tem como ser respondido.
    if (
      FormFieldEntity.isOptionsBased(input.type) &&
      !FormFieldEntity.hasUsableOptions(input.options)
    ) {
      return [`Campo do tipo "${input.type}" exige uma lista de opções`];
    }
    return [];
  }
}
