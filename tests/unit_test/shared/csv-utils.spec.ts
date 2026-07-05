import { answerToString, escapeCell } from '@shared/csv-utils';

describe('escapeCell', () => {
  it('wraps and doubles quotes when value contains a quote', () => {
    expect(escapeCell('A "B" C')).toBe('"A ""B"" C"');
  });

  it('wraps value containing a comma', () => {
    expect(escapeCell('ACME, Ltda')).toBe('"ACME, Ltda"');
  });

  it('wraps value containing a newline', () => {
    expect(escapeCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('leaves plain values untouched', () => {
    expect(escapeCell('plain')).toBe('plain');
  });

  it('neutralizes formula-injection values starting with =, +, -, @', () => {
    expect(escapeCell('=1+1')).toBe("'=1+1");
    expect(escapeCell('+2+3')).toBe("'+2+3");
    expect(escapeCell('-2+3')).toBe("'-2+3");
    expect(escapeCell('@SUM(1+1)')).toBe("'@SUM(1+1)");
  });

  it('still quotes a neutralized formula value that also contains a comma', () => {
    expect(escapeCell('=1+1,2')).toBe('"\'=1+1,2"');
  });
});

describe('answerToString', () => {
  it('returns empty string for null/undefined', () => {
    expect(answerToString(null)).toBe('');
    expect(answerToString(undefined)).toBe('');
  });

  it('passes strings through', () => {
    expect(answerToString('hello')).toBe('hello');
  });

  it('stringifies numbers and booleans', () => {
    expect(answerToString(42)).toBe('42');
    expect(answerToString(true)).toBe('true');
  });

  it('joins arrays with "; "', () => {
    expect(answerToString(['a', 'b'])).toBe('a; b');
  });

  it('falls back to JSON.stringify for objects', () => {
    expect(answerToString({ x: 1 })).toBe('{"x":1}');
  });
});
