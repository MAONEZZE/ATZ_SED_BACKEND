import { normalizePhone } from '@shared/phone';

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
