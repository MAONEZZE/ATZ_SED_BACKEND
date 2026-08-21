import { answerToString } from '@application/shared/csv-utils';
import { buildCsv, CsvColumn } from '@application/shared/csv-builder';
import { FormResponseWithContext } from '@domain/form_response_module/i-repository-form-response';

export interface CsvFormField {
  id: string;
  label: string;
}

/**
 * CSV das respostas de um formulário. As colunas dinâmicas vêm dos campos do
 * formulário — por isso a exportação é por formulário, não do evento inteiro
 * (formulários diferentes têm colunas diferentes).
 */
export function buildFormResponsesCsv(
  rows: FormResponseWithContext[],
  fields: CsvFormField[],
): string {
  const columns: CsvColumn<FormResponseWithContext>[] = [
    { header: 'formulario', value: (r) => r.formName },
    { header: 'nome', value: (r) => r.name },
    { header: 'email', value: (r) => r.email },
    { header: 'telefone', value: (r) => r.phone },
    { header: 'status', value: (r) => r.status ?? '' },
    { header: 'respondido_em', value: (r) => r.createdAt.toISOString() },
    ...fields.map(
      (f): CsvColumn<FormResponseWithContext> => ({
        header: f.label,
        value: (r) => answerToString(r.answers?.[f.id]),
      }),
    ),
  ];
  return buildCsv(rows, columns);
}
