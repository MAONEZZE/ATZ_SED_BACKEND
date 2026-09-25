import { BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';

export interface AnswerFieldMeta {
  id: string;
  label: string;
  type?: string;
  required: boolean;
  options?: unknown;
}

interface DocumentAnswer {
  url: string;
  name: string;
  mimetype: string | null;
  size: number | null;
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
export function resolveFieldAnswer(
  answers: Record<string, unknown>,
  field: { id: string; label: string },
): unknown {
  if (Object.prototype.hasOwnProperty.call(answers, field.id)) {
    return answers[field.id];
  }
  return buildAnswerLookup(answers).get(normalizeAnswerKey(field.label));
}

function isDocumentAnswer(value: unknown): value is DocumentAnswer {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const file = value as Partial<DocumentAnswer>;
  return (
    typeof file.url === 'string' &&
    !file.url.startsWith('data:') &&
    isValidUrl(file.url) &&
    typeof file.name === 'string' &&
    file.name.trim().length > 0 &&
    (typeof file.mimetype === 'string' || file.mimetype === null) &&
    (typeof file.size === 'number' || file.size === null)
  );
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

export function rejectDataUris(value: unknown): void {
  if (typeof value === 'string' && value.trimStart().startsWith('data:')) {
    throw new BadRequestException(
      'Respostas em data URI não são aceitas; envie o arquivo primeiro',
    );
  }
  if (Array.isArray(value)) {
    value.forEach(rejectDataUris);
  } else if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach(rejectDataUris);
  }
}

/**
 * Validates submitted form answers against the organizer-configured fields:
 * required presence, plus basic type/range coherence for typed fields
 * (email, date, checkbox, select/multiselect membership against `options`).
 */
export function validateAnswers(fields: AnswerFieldMeta[], answers: Record<string, unknown>): void {
  for (const field of fields) {
    const val = resolveFieldAnswer(answers, field);
    const isEmpty =
      val === undefined ||
      val === null ||
      (typeof val === 'string' && val.trim() === '') ||
      (Array.isArray(val) && val.length === 0);

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
          throw new BadRequestException(
            `Campo "${field.label}" deve ser uma data no formato AAAA-MM-DD`,
          );
        }
        break;
      case 'linkedin':
        if (typeof val !== 'string' || !isValidUrl(val)) {
          throw new BadRequestException(`Campo "${field.label}" deve ser uma URL válida`);
        }
        break;
      case 'instagram':
        if (typeof val !== 'string' || !INSTAGRAM_HANDLE_RE.test(val)) {
          throw new BadRequestException(
            `Campo "${field.label}" deve ser um @usuário do Instagram válido`,
          );
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
      case 'document': {
        if (!Array.isArray(val) || !val.every(isDocumentAnswer)) {
          throw new BadRequestException(
            `Campo "${field.label}" deve conter uma lista de arquivos enviados`,
          );
        }
        const maxFiles =
          field.options && typeof field.options === 'object' && !Array.isArray(field.options)
            ? (field.options as { maxFiles?: unknown }).maxFiles
            : undefined;
        const limit =
          Number.isInteger(maxFiles) && (maxFiles as number) > 0 ? (maxFiles as number) : 1;
        if (val.length > limit) {
          throw new BadRequestException(
            `Campo "${field.label}" aceita no máximo ${limit} arquivo(s)`,
          );
        }
        break;
      }
    }
  }
}
