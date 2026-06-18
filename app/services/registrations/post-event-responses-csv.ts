import { answerToString, escapeCell } from '@services/registrations/csv-utils';

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

const FIXED_HEADERS = ['nome', 'email', 'telefone'];

export function buildPostEventResponsesCsv(
  responses: CsvPostEventResponse[],
  postEventFields: CsvPostEventField[],
): string {
  const dynamicLabels = postEventFields.map((f) => f.label);
  const header = [...FIXED_HEADERS, ...dynamicLabels, 'data_resposta'];

  const rows = responses.map((resp) => {
    const dynamic = dynamicLabels.map((label) => answerToString(resp.answers?.[label]));
    return [resp.name, resp.email, resp.phone, ...dynamic, resp.createdAt.toISOString()]
      .map(escapeCell)
      .join(',');
  });

  return '﻿' + [header.map(escapeCell).join(','), ...rows].join('\n');
}
