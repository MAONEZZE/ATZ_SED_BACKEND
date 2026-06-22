import { answerToString, escapeCell, formatDateBrasilia } from '@services/registrations/csv-utils';

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

const FIXED_HEADERS = [
  'Nome',
  'E-mail',
  'Telefone',
  'Enviar Pipedrive',
  'Status Pipedrive',
  'Criado em',
  'Atualizado em',
];

export function buildUserSubscriptionsCsv(
  rows: CsvUserSubscription[],
  fields: CsvUserSubscriptionFields,
): string {
  const regLabels = fields.registration.map((f) => f.label);
  const postLabels = fields.postEvent.map((f) => f.label);
  const npsLabels = fields.nps.map((f) => f.label);

  const header = [
    ...FIXED_HEADERS,
    ...regLabels.map((l) => `Inscrição: ${l}`),
    ...postLabels.map((l) => `Pós-evento: ${l}`),
    ...npsLabels.map((l) => `NPS: ${l}`),
  ];

  const lines = rows.map((row) => {
    const fixed = [
      row.name ?? '',
      row.email ?? '',
      row.phone ?? '',
      row.sendToPipedrive ? 'sim' : 'não',
      row.pipedriveStatus ?? '',
      formatDateBrasilia(row.createdAt),
      formatDateBrasilia(row.updatedAt),
    ];
    const reg = regLabels.map((l) => answerToString(row.registrationAnswers?.[l]));
    const post = postLabels.map((l) => answerToString(row.postEventAnswers?.[l]));
    const nps = npsLabels.map((l) => answerToString(row.npsAnswers?.[l]));
    return [...fixed, ...reg, ...post, ...nps].map(escapeCell).join(',');
  });

  return '﻿' + [header.map(escapeCell).join(','), ...lines].join('\n');
}
