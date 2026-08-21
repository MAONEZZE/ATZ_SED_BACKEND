import { BadRequestException } from '@nestjs/common';
import {
  validateAnswers,
  resolveAnswer,
  resolveAnswerByKeys,
  mapAnswersToFieldIds,
  hydrateAnswerLabels,
} from '@domain/shared/answer-validation';

describe('validateAnswers — resolve by id, fallback to label for raw submissions', () => {
  it('passes when the answer key differs in case from the field label (raw label-keyed submission)', () => {
    const fields = [{ id: 'f1', label: 'Nome', required: true }];
    expect(() => validateAnswers(fields, { nome: 'Fulano' })).not.toThrow();
  });

  it('passes when the answer key has surrounding whitespace', () => {
    const fields = [{ id: 'f1', label: 'Nome', required: true }];
    expect(() => validateAnswers(fields, { ' Nome ': 'Fulano' })).not.toThrow();
  });

  it('resolves directly by field.id when the answers are already id-keyed', () => {
    const fields = [{ id: 'f1', label: 'Nome', required: true }];
    expect(() => validateAnswers(fields, { f1: 'Fulano' })).not.toThrow();
  });

  it('still throws when the required field is genuinely absent', () => {
    const fields = [{ id: 'f1', label: 'Nome', required: true }];
    expect(() => validateAnswers(fields, {})).toThrow(BadRequestException);
  });

  it('still throws when the required field is present but blank', () => {
    const fields = [{ id: 'f1', label: 'Nome', required: true }];
    expect(() => validateAnswers(fields, { nome: '   ' })).toThrow(BadRequestException);
  });

  it('error message uses the human label, never the id', () => {
    const fields = [{ id: 'f1', label: 'Nome', required: true }];
    expect(() => validateAnswers(fields, {})).toThrow('Nome');
  });
});

describe('resolveAnswer (deprecated, label-based)', () => {
  it('matches a label case/whitespace-insensitively', () => {
    expect(resolveAnswer({ NOME: 'Fulano' }, 'nome')).toBe('Fulano');
    expect(resolveAnswer({ ' Nome Completo ': 'Fulano' }, 'nome completo')).toBe('Fulano');
    expect(resolveAnswer({ nome: 'Fulano' }, 'telefone')).toBeUndefined();
  });
});

describe('resolveAnswerByKeys (deprecated, label-based)', () => {
  it('returns the value for the first matching candidate key, case-insensitively', () => {
    expect(resolveAnswerByKeys({ Nome: 'Fulano' }, ['nome', 'name'])).toBe('Fulano');
    expect(resolveAnswerByKeys({ Name: 'Fulano' }, ['nome', 'name'])).toBe('Fulano');
    expect(resolveAnswerByKeys({}, ['nome', 'name'])).toBeUndefined();
  });
});

describe("validateAnswers — case 'on_date_automation_field'", () => {
  const fields = [
    { id: 'f1', label: 'Dia da mensalidade', type: 'on_date_automation_field', required: true },
  ];

  it('accepts a real AAAA-MM-DD date', () => {
    expect(() => validateAnswers(fields, { 'Dia da mensalidade': '2026-10-20' })).not.toThrow();
  });

  it.each(['20/10/2026', '2026', '2026-13-01', '2026-02-30'])(
    'rejects %s',
    (value) => {
      expect(() => validateAnswers(fields, { 'Dia da mensalidade': value })).toThrow(
        BadRequestException,
      );
    },
  );

  it('rejects a number', () => {
    expect(() => validateAnswers(fields, { 'Dia da mensalidade': 20 })).toThrow(
      BadRequestException,
    );
  });

  it('passes when empty and not required', () => {
    const optional = [{ ...fields[0], required: false }];
    expect(() => validateAnswers(optional, {})).not.toThrow();
  });

  it("does not affect the legacy 'date' branch (still loose, on purpose)", () => {
    const dateFields = [{ id: 'f2', label: 'Nascimento', type: 'date', required: true }];
    expect(() => validateAnswers(dateFields, { Nascimento: '09/01/2026' })).not.toThrow();
    expect(() => validateAnswers(dateFields, { Nascimento: '2026' })).not.toThrow();
  });
});

describe('mapAnswersToFieldIds', () => {
  const fields = [
    { id: 'id-nome', label: 'Nome' },
    { id: 'id-email', label: 'E-mail' },
  ];

  it('converts label-keyed answers to id-keyed', () => {
    expect(mapAnswersToFieldIds(fields, { Nome: 'Fulano', 'E-mail': 'a@b.com' })).toEqual({
      'id-nome': 'Fulano',
      'id-email': 'a@b.com',
    });
  });

  it('tolerates case/whitespace mismatch between the key and the label', () => {
    expect(mapAnswersToFieldIds(fields, { ' nome ': 'Fulano' })).toEqual({ 'id-nome': 'Fulano' });
  });

  it('discards a key that matches no field', () => {
    expect(mapAnswersToFieldIds(fields, { Nome: 'Fulano', lixo: 'x' })).toEqual({
      'id-nome': 'Fulano',
    });
  });
});

describe('hydrateAnswerLabels', () => {
  const fields = [
    { id: 'id-nome', label: 'Nome' },
    { id: 'id-email', label: 'E-mail' },
  ];

  it('is the inverse of mapAnswersToFieldIds', () => {
    expect(hydrateAnswerLabels(fields, { 'id-nome': 'Fulano', 'id-email': 'a@b.com' })).toEqual({
      Nome: 'Fulano',
      'E-mail': 'a@b.com',
    });
  });

  it('reflects a label rename without losing the answer', () => {
    const renamed = [{ id: 'id-nome', label: 'Nome completo' }];
    expect(hydrateAnswerLabels(renamed, { 'id-nome': 'Fulano' })).toEqual({
      'Nome completo': 'Fulano',
    });
  });

  it('keeps an orphan key (field deleted afterwards) under its own key', () => {
    expect(hydrateAnswerLabels(fields, { 'id-nome': 'Fulano', 'deleted-field-id': 'x' })).toEqual({
      Nome: 'Fulano',
      'deleted-field-id': 'x',
    });
  });
});
