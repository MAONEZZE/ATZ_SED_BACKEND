import { buildRegistrationsCsv } from '@application/registration_module/registration-csv';

const EMPRESA_ID = 'empresa-id';

const reg = {
  name: 'João',
  email: 'joao@test.com',
  phone: '+5511999999999',
  status: 'pending',
  createdAt: new Date('2026-06-01T12:00:00Z'),
  imageAuthorization: true,
  attended: false,
  answers: {
    [EMPRESA_ID]: 'ACME, Ltda',
  },
};

describe('buildRegistrationsCsv', () => {
  it('renders fixed header + dynamic columns from form field labels', () => {
    const csv = buildRegistrationsCsv([reg], [{ id: EMPRESA_ID, label: 'Empresa' }]);
    const lines = csv.replace(/^﻿/, '').split('\n');
    expect(lines[0]).toBe(
      'nome,email,telefone,status,data_inscricao,autorizacao_imagem,compareceu,Empresa',
    );
  });

  it('escapes values containing commas/quotes and formats date as ISO', () => {
    const csv = buildRegistrationsCsv([reg], [{ id: EMPRESA_ID, label: 'Empresa' }]);
    const lines = csv.replace(/^﻿/, '').split('\n');
    // Leading "'" neutralizes CSV-formula injection for cells starting with +/-/=/@
    // (Excel/Sheets hide the marker and render the value as plain text).
    expect(lines[1]).toBe(
      'João,joao@test.com,\'+5511999999999,pending,2026-06-01T12:00:00.000Z,sim,não,"ACME, Ltda"',
    );
  });

  it('marks attendance in the fixed columns', () => {
    const csv = buildRegistrationsCsv([{ ...reg, attended: true }], []);
    const lines = csv.replace(/^﻿/, '').split('\n');
    expect(lines[1].endsWith(',sim,sim')).toBe(true);
  });

  it('starts with UTF-8 BOM for Excel compatibility', () => {
    const csv = buildRegistrationsCsv([reg], []);
    expect(csv.startsWith('﻿')).toBe(true);
  });

  it('doubles internal quotes when escaping', () => {
    const withQuote = {
      ...reg,
      answers: { ...reg.answers, [EMPRESA_ID]: 'A "B" C' },
    };
    const csv = buildRegistrationsCsv([withQuote], [{ id: EMPRESA_ID, label: 'Empresa' }]);
    expect(csv).toContain('"A ""B"" C"');
  });

  it('leaves empty cell when answer for a dynamic column is missing', () => {
    const csv = buildRegistrationsCsv([reg], [{ id: 'cargo-id', label: 'Cargo' }]);
    const lines = csv.replace(/^﻿/, '').split('\n');
    expect(lines[1].endsWith(',')).toBe(true);
  });
});
