import { answerToString } from '@shared/csv-utils';
import { buildCsv, CsvColumn } from '@shared/csv-builder';

export interface CsvRegistration {
  name: string;
  email: string;
  phone: string;
  status: string;
  createdAt?: Date;
  answers: Record<string, unknown>;
  imageAuthorization: boolean;
}

export interface CsvFormField {
  label: string;
}

export function buildRegistrationsCsv(
  registrations: CsvRegistration[],
  formFields: CsvFormField[],
): string {
  const columns: CsvColumn<CsvRegistration>[] = [
    { header: 'nome', value: (r) => r.name },
    { header: 'email', value: (r) => r.email },
    { header: 'telefone', value: (r) => r.phone },
    { header: 'status', value: (r) => r.status },
    { header: 'data_inscricao', value: (r) => (r.createdAt ? r.createdAt.toISOString() : '') },
    { header: 'autorizacao_imagem', value: (r) => (r.imageAuthorization ? 'sim' : 'não') },
    ...formFields.map(
      (f): CsvColumn<CsvRegistration> => ({
        header: f.label,
        value: (r) => answerToString(r.answers?.[f.label]),
      }),
    ),
  ];

  return buildCsv(registrations, columns);
}
