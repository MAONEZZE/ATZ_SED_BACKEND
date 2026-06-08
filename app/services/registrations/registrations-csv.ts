export interface CsvRegistration {
  name: string;
  email: string;
  phone: string;
  status: string;
  createdAt?: Date;
  answers: Record<string, unknown>;
}

export interface CsvFormField {
  label: string;
}

const FIXED_HEADERS = ['nome', 'email', 'telefone', 'status', 'data_inscricao'];

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
  return JSON.stringify(value);
}

export function buildRegistrationsCsv(
  registrations: CsvRegistration[],
  formFields: CsvFormField[],
): string {
  const dynamicLabels = formFields.map((f) => f.label);
  const header = [...FIXED_HEADERS, ...dynamicLabels];

  const rows = registrations.map((reg) => {
    const fixed = [
      reg.name,
      reg.email,
      reg.phone,
      reg.status,
      reg.createdAt ? reg.createdAt.toISOString() : '',
    ];
    const dynamic = dynamicLabels.map((label) => answerToString(reg.answers?.[label]));
    return [...fixed, ...dynamic].map(escapeCell).join(',');
  });

  // BOM so Excel opens UTF-8 correctly
  return '﻿' + [header.map(escapeCell).join(','), ...rows].join('\n');
}
