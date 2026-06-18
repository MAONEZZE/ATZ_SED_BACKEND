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

const FIXED_HEADERS = ['Nome', 'Email', 'Telefone'];

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function answerToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(answerToString).join('; ');
  }
  return JSON.stringify(value);
}

export function buildPostEventResponsesCsv(
  responses: CsvPostEventResponse[],
  postEventFields: CsvPostEventField[],
): string {
  const dynamicLabels = postEventFields.map((f) => f.label);
  const header = [...FIXED_HEADERS, ...dynamicLabels, 'Data'];

  const rows = responses.map((resp) => {
    const dynamic = dynamicLabels.map((label) => answerToString(resp.answers?.[label]));
    return [
      resp.name,
      resp.email,
      resp.phone,
      ...dynamic,
      resp.createdAt.toISOString().slice(0, 10),
    ]
      .map(escapeCell)
      .join(',');
  });

  return '﻿' + [header.map(escapeCell).join(','), ...rows].join('\n');
}
