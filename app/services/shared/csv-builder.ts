import { escapeCell } from '@services/shared/csv-utils';

/** A single CSV column: a header and how to extract its (already stringified) cell value from a row. */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string;
}

/**
 * Generic CSV builder. Prepends a UTF-8 BOM (Excel-friendly), escapes every cell,
 * and joins rows with newlines. Callers describe their output purely as columns —
 * fixed and dynamic columns are just entries in the same array, so the three
 * domain CSVs (registrations, post-event, user-subscriptions) share this code.
 */
export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(','));
  return '﻿' + [header, ...lines].join('\n');
}
