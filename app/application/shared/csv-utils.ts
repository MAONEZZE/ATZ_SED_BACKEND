import { DateTime } from 'luxon';
import { APP_TIMEZONE } from '@handlers/timezone';

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

/**
 * Data para planilha, sempre no fuso da aplicacao. O banco guarda UTC; jogar o
 * `toISOString()` cru na celula entregava ao usuario BR uma hora 3h adiantada
 * (inscricao das 12h aparecia como 15:00). `dd/MM/yyyy HH:mm` e o formato que
 * Excel e Google Sheets reconhecem como data em pt-BR.
 */
export function formatCsvDate(value: Date | null | undefined): string {
  if (!value) return '';
  const dt = DateTime.fromJSDate(value).setZone(APP_TIMEZONE);
  return dt.isValid ? dt.toFormat('dd/MM/yyyy HH:mm') : '';
}
