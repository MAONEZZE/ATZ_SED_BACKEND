import { normalizePhone, phoneMatchKey, phoneMatchSuffix } from '@handlers/phone';

describe('normalizePhone', () => {
  it('normalizes varying formats of the same BR mobile number to the same digits', () => {
    const expected = '5511912345678';
    expect(normalizePhone('(11) 91234-5678')).toBe(expected);
    expect(normalizePhone('11912345678')).toBe(expected);
    expect(normalizePhone('+55 11 91234-5678')).toBe(expected);
  });

  it('normalizes a landline (10-digit national number)', () => {
    expect(normalizePhone('(11) 3123-4567')).toBe('551131234567');
  });

  it('returns null for an empty or unparseable input', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
  });

  it('returns null when the digit count does not match a valid BR length', () => {
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone('123456789012345')).toBeNull();
  });

  it('returns null for an invalid DDD', () => {
    expect(normalizePhone('00912345678')).toBeNull();
  });
});

describe('phoneMatchKey', () => {
  // É o que permite o check-in por telefone achar a pessoa num banco com número
  // gravado em formatos diferentes.
  it('collapses mask, country code and ninth digit to the same key', () => {
    const expected = phoneMatchKey('11999998888');

    expect(expected).not.toBeNull();
    expect(phoneMatchKey('(11) 99999-8888')).toBe(expected);
    expect(phoneMatchKey('+55 11 99999-8888')).toBe(expected);
    expect(phoneMatchKey('5511999998888')).toBe(expected);
    expect(phoneMatchKey('1199998888')).toBe(expected);
  });

  it('keeps different area codes apart even with the same final digits', () => {
    expect(phoneMatchKey('11999998888')).not.toBe(phoneMatchKey('21999998888'));
  });

  it('returns null when there are not enough digits for DDD + number', () => {
    expect(phoneMatchKey('')).toBeNull();
    expect(phoneMatchKey('99998888')).toBeNull();
    expect(phoneMatchKey('abc')).toBeNull();
  });

  it('exposes the last 8 digits as the DB pre-filter', () => {
    expect(phoneMatchSuffix(phoneMatchKey('(11) 99999-8888') as string)).toBe('99998888');
  });
});
