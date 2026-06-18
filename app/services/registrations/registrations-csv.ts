import { answerToString, escapeCell } from '@services/registrations/csv-utils';

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

  return '﻿' + [header.map(escapeCell).join(','), ...rows].join('\n');
}
