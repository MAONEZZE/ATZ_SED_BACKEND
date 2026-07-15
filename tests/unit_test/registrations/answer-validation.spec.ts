import { BadRequestException } from '@nestjs/common';
import {
  validateAnswers,
  resolveAnswer,
  resolveAnswerByKeys,
} from '@modules/registrations/answer-validation';

describe('validateAnswers — case/whitespace-tolerant key resolution', () => {
  it('passes when the answer key differs in case from the field label', () => {
    const fields = [{ label: 'Nome', required: true }];
    expect(() => validateAnswers(fields, { nome: 'Fulano' })).not.toThrow();
  });

  it('passes when the answer key has surrounding whitespace', () => {
    const fields = [{ label: 'Nome', required: true }];
    expect(() => validateAnswers(fields, { ' Nome ': 'Fulano' })).not.toThrow();
  });

  it('still throws when the required field is genuinely absent', () => {
    const fields = [{ label: 'Nome', required: true }];
    expect(() => validateAnswers(fields, {})).toThrow(BadRequestException);
  });

  it('still throws when the required field is present but blank', () => {
    const fields = [{ label: 'Nome', required: true }];
    expect(() => validateAnswers(fields, { nome: '   ' })).toThrow(BadRequestException);
  });
});

describe('resolveAnswer', () => {
  it('matches a label case/whitespace-insensitively', () => {
    expect(resolveAnswer({ NOME: 'Fulano' }, 'nome')).toBe('Fulano');
    expect(resolveAnswer({ ' Nome Completo ': 'Fulano' }, 'nome completo')).toBe('Fulano');
    expect(resolveAnswer({ nome: 'Fulano' }, 'telefone')).toBeUndefined();
  });
});

describe('resolveAnswerByKeys', () => {
  it('returns the value for the first matching candidate key, case-insensitively', () => {
    expect(resolveAnswerByKeys({ Nome: 'Fulano' }, ['nome', 'name'])).toBe('Fulano');
    expect(resolveAnswerByKeys({ Name: 'Fulano' }, ['nome', 'name'])).toBe('Fulano');
    expect(resolveAnswerByKeys({}, ['nome', 'name'])).toBeUndefined();
  });
});
