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
