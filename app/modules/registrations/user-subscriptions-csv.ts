import { answerToString, formatDateBrasilia } from '@shared/csv-utils';
import { buildCsv, CsvColumn } from '@shared/csv-builder';

export interface CsvUserSubscription {
  name: string | null;
  email: string | null;
  phone: string | null;
  sendToPipedrive: boolean;
  pipedriveStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
  registrationAnswers: Record<string, unknown> | null;
  postEventAnswers: Record<string, unknown> | null;
  npsAnswers: Record<string, unknown> | null;
}

export interface CsvField {
  label: string;
}

export interface CsvUserSubscriptionFields {
  registration: CsvField[];
  postEvent: CsvField[];
  nps: CsvField[];
}

/** Builds an answer column that reads `label` from the given answers bag of the row. */
function answerColumn(
  prefix: string,
  label: string,
  pick: (row: CsvUserSubscription) => Record<string, unknown> | null,
): CsvColumn<CsvUserSubscription> {
  return {
    header: `${prefix}: ${label}`,
    value: (row) => answerToString(pick(row)?.[label]),
  };
}

export function buildUserSubscriptionsCsv(
  rows: CsvUserSubscription[],
  fields: CsvUserSubscriptionFields,
): string {
  const columns: CsvColumn<CsvUserSubscription>[] = [
    { header: 'Nome', value: (r) => r.name ?? '' },
    { header: 'E-mail', value: (r) => r.email ?? '' },
    { header: 'Telefone', value: (r) => r.phone ?? '' },
    { header: 'Enviar Pipedrive', value: (r) => (r.sendToPipedrive ? 'sim' : 'não') },
    { header: 'Status Pipedrive', value: (r) => r.pipedriveStatus ?? '' },
    { header: 'Criado em', value: (r) => formatDateBrasilia(r.createdAt) },
    { header: 'Atualizado em', value: (r) => formatDateBrasilia(r.updatedAt) },
    ...fields.registration.map((f) => answerColumn('Inscrição', f.label, (r) => r.registrationAnswers)),
    ...fields.postEvent.map((f) => answerColumn('Pós-evento', f.label, (r) => r.postEventAnswers)),
    ...fields.nps.map((f) => answerColumn('NPS', f.label, (r) => r.npsAnswers)),
  ];

  return buildCsv(rows, columns);
}
