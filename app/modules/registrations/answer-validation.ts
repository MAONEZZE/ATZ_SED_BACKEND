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

/**
 * Validates submitted form answers against the organizer-configured fields:
 * required presence, plus basic type/range coherence for typed fields
 * (email, date, checkbox, select/multiselect membership against `options`).
 */
export function validateAnswers(
  fields: AnswerFieldMeta[],
  answers: Record<string, unknown>,
): void {
  for (const field of fields) {
    const val = answers[field.label];
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
