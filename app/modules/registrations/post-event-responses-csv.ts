import { answerToString } from '@shared/csv-utils';
import { buildCsv, CsvColumn } from '@shared/csv-builder';

export interface CsvPostEventResponse {
  name: string;
  email: string;
  phone: string;
  answers: Record<string, unknown>;
  createdAt: Date;
}

export interface CsvPostEventField {
  label: string;
}

export function buildPostEventResponsesCsv(
  responses: CsvPostEventResponse[],
  postEventFields: CsvPostEventField[],
): string {
  const columns: CsvColumn<CsvPostEventResponse>[] = [
    { header: 'nome', value: (r) => r.name },
    { header: 'email', value: (r) => r.email },
    { header: 'telefone', value: (r) => r.phone },
    ...postEventFields.map(
      (f): CsvColumn<CsvPostEventResponse> => ({
        header: f.label,
        value: (r) => answerToString(r.answers?.[f.label]),
      }),
    ),
    { header: 'data_resposta', value: (r) => r.createdAt.toISOString() },
  ];

  return buildCsv(responses, columns);
}
