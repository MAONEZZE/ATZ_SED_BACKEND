import { BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';

export interface AnswerFieldMeta {
  id: string;
  label: string;
  type?: string;
  required: boolean;
  options?: unknown;
}

/** O mínimo para converter entre label e id — dispensa `required`/`type`. */
export interface AnswerFieldKey {
  id: string;
  label: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INSTAGRAM_HANDLE_RE = /^@?[\w.]{1,30}$/;

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

/**
 * @deprecated Chave canônica de `answers` é `FormField.id`. Só para dado
 * legado/importado que nunca passou por `mapAnswersToFieldIds`.
 */
export function resolveAnswer(answers: Record<string, unknown>, label: string): unknown {
  return buildAnswerLookup(answers).get(normalizeAnswerKey(label));
}

/**
 * @deprecated Chave canônica de `answers` é `FormField.id`. Só para dado
 * legado/importado que nunca passou por `mapAnswersToFieldIds`.
 */
export function resolveAnswerByKeys(answers: Record<string, unknown>, keys: string[]): unknown {
  const lookup = buildAnswerLookup(answers);
  for (const key of keys) {
    const val = lookup.get(normalizeAnswerKey(key));
    if (val !== undefined) return val;
  }
  return undefined;
}

/**
 * Resolve o valor de um campo em `answers` já convertido por id (chave
 * canônica); cai para o label normalizado se a chave ainda não foi convertida
 * (submissão pública crua, ainda chaveada por label).
 */
function resolveFieldAnswer(
  answers: Record<string, unknown>,
  field: { id: string; label: string },
): unknown {
  if (Object.prototype.hasOwnProperty.call(answers, field.id)) {
    return answers[field.id];
  }
  return buildAnswerLookup(answers).get(normalizeAnswerKey(field.label));
}

/**
 * Converte `answers` chaveado por label (o que o front manda) para chaveado
 * por `field.id` — a chave canônica no banco. Chave que não casa com campo
 * nenhum é descartada (caller deve logar quantas, comparando o tamanho dos
 * dois objetos).
 */
export function mapAnswersToFieldIds(
  fields: AnswerFieldKey[],
  answers: Record<string, unknown>,
): Record<string, unknown> {
  const lookup = buildAnswerLookup(answers);
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    const key = normalizeAnswerKey(field.label);
    if (lookup.has(key)) {
      result[field.id] = lookup.get(key);
    }
  }
  return result;
}

/**
 * Inverso de `mapAnswersToFieldIds`: para as bordas de leitura (API, CSV,
 * Pipedrive). Chave que não casa com nenhum campo (campo apagado depois)
 * passa reto sob a própria chave, para o dado não desaparecer da tela.
 */
export function hydrateAnswerLabels(
  fields: AnswerFieldKey[],
  answers: Record<string, unknown>,
): Record<string, unknown> {
  const labelById = new Map(fields.map((f) => [f.id, f.label]));
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(answers)) {
    result[labelById.get(key) ?? key] = value;
  }
  return result;
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
    const val = resolveFieldAnswer(answers, field);
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
      // Estrito de propósito: nunca reusar o branch 'date' acima, que aceita
      // "2026" e "09/01/2026" via Date.parse. O sweeper mensal só sabe extrair
      // o dia de um AAAA-MM-DD real.
      case 'on_date_automation_field':
        if (
          typeof val !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(val) ||
          !DateTime.fromISO(val).isValid
        ) {
          throw new BadRequestException(`Campo "${field.label}" deve ser uma data no formato AAAA-MM-DD`);
        }
        break;
      case 'linkedin':
        if (typeof val !== 'string' || !isValidUrl(val)) {
          throw new BadRequestException(`Campo "${field.label}" deve ser uma URL válida`);
        }
        break;
      case 'instagram':
        if (typeof val !== 'string' || !INSTAGRAM_HANDLE_RE.test(val)) {
          throw new BadRequestException(`Campo "${field.label}" deve ser um @usuário do Instagram válido`);
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
