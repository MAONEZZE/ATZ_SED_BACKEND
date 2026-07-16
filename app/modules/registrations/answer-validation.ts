import { BadRequestException } from '@nestjs/common';

export interface AnswerFieldMeta {
  label: string;
  type?: string;
  required: boolean;
  options?: unknown;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidUrl(val: string): boolean {
  try {
    new URL(val);
    return true;
  } catch {
    return false;
  }
}

function normalizeAnswerKey(key: string): string {
  return key.trim().toLowerCase();
}

/** Case/whitespace-tolerant map of the submitted answers, keyed by normalized key. */
export function buildAnswerLookup(answers: Record<string, unknown>): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const key of Object.keys(answers)) {
    map.set(normalizeAnswerKey(key), answers[key]);
  }
  return map;
}

/** Resolves an answer by field label, tolerant of case/whitespace mismatch with the submitted key. */
export function resolveAnswer(answers: Record<string, unknown>, label: string): unknown {
  return buildAnswerLookup(answers).get(normalizeAnswerKey(label));
}

/** Resolves an answer trying each candidate key in order, case/whitespace-tolerant. */
export function resolveAnswerByKeys(answers: Record<string, unknown>, keys: string[]): unknown {
  const lookup = buildAnswerLookup(answers);
  for (const key of keys) {
    const val = lookup.get(normalizeAnswerKey(key));
    if (val !== undefined) return val;
  }
  return undefined;
}

/**
 * Validates submitted form answers against the organizer-configured fields:
 * required presence, plus basic type/range coherence for typed fields
 * (email, date, checkbox, select/multiselect membership against `options`).
 */
export function validateAnswers(
  fields: AnswerFieldMeta[],
  answers: Record<string, unknown>,
): void {
  const lookup = buildAnswerLookup(answers);
  for (const field of fields) {
    const val = lookup.get(normalizeAnswerKey(field.label));
    const isEmpty = val === undefined || val === null || String(val).trim() === '';

    if (field.required && isEmpty) {
      throw new BadRequestException(`Campo obrigatório ausente: "${field.label}"`);
    }
    if (isEmpty) continue;

    switch (field.type) {
      case 'email':
        if (typeof val !== 'string' || !EMAIL_RE.test(val)) {
          throw new BadRequestException(`Campo "${field.label}" deve ser um email válido`);
        }
        break;
      case 'date':
        if (typeof val !== 'string' || Number.isNaN(Date.parse(val))) {
          throw new BadRequestException(`Campo "${field.label}" deve ser uma data válida`);
        }
        break;
      case 'linkedin':
      case 'instagram':
        if (typeof val !== 'string' || !isValidUrl(val)) {
          throw new BadRequestException(`Campo "${field.label}" deve ser uma URL válida`);
        }
        break;
      case 'checkbox':
        if (typeof val !== 'boolean' && val !== 'true' && val !== 'false') {
          throw new BadRequestException(`Campo "${field.label}" deve ser verdadeiro/falso`);
        }
        break;
      case 'select': {
        const options = Array.isArray(field.options) ? field.options : null;
        if (options && !options.includes(val)) {
          throw new BadRequestException(`Campo "${field.label}" tem valor inválido`);
        }
        break;
      }
      case 'multiselect': {
        const options = Array.isArray(field.options) ? field.options : null;
        if (options) {
          const values = Array.isArray(val) ? val : [val];
          for (const v of values) {
            if (!options.includes(v)) {
              throw new BadRequestException(`Campo "${field.label}" tem valor inválido`);
            }
          }
        }
        break;
      }
    }
  }
}
