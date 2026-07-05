import { APP_TIMEZONE } from '@shared/timezone';

const FORMULA_TRIGGER_RE = /^[=+\-@\t\r]/;

export function escapeCell(value: string): string {
  // Neutralize spreadsheet formula injection (Excel/Google Sheets execute a
  // cell as a formula when it starts with =, +, -, or @).
  const safeValue = FORMULA_TRIGGER_RE.test(value) ? `'${value}` : value;
  if (/[",\n]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}

/** Formats a Date in America/Sao_Paulo as DD/MM/YYYY HH:mm (24h), TZ-independent. */
export function formatDateBrasilia(date: Date): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: APP_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

export function answerToString(value: unknown): string {
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
