import { buildPostEventResponsesCsv } from '@modules/registrations/post-event-responses-csv';

const response = {
  name: 'João',
  email: 'joao@test.com',
  phone: '+5511999999999',
  answers: {
    Nota: '10',
    Comentario: 'Muito bom, recomendo',
  },
  createdAt: new Date('2026-06-01T12:00:00Z'),
};

describe('buildPostEventResponsesCsv', () => {
  it('renders fixed header + dynamic columns from post-event field labels', () => {
    const csv = buildPostEventResponsesCsv([response], [{ label: 'Nota' }, { label: 'Cargo' }]);
    const lines = csv.replace(/^﻿/, '').split('\n');
    expect(lines[0]).toBe('nome,email,telefone,Nota,Cargo,data_resposta');
  });

  it('fills present answers, leaves empty cell for absent ones, and formats date as ISO', () => {
    const csv = buildPostEventResponsesCsv([response], [{ label: 'Nota' }, { label: 'Cargo' }]);
    const lines = csv.replace(/^﻿/, '').split('\n');
    expect(lines[1]).toBe('João,joao@test.com,+5511999999999,10,,2026-06-01T12:00:00.000Z');
  });

  it('escapes values containing commas', () => {
    const csv = buildPostEventResponsesCsv([response], [{ label: 'Comentario' }]);
    expect(csv).toContain('"Muito bom, recomendo"');
  });

  it('starts with UTF-8 BOM for Excel compatibility', () => {
    const csv = buildPostEventResponsesCsv([response], []);
    expect(csv.startsWith('﻿')).toBe(true);
  });

  it('joins array answers and stringifies objects like registrations-csv', () => {
    const withComplex = {
      ...response,
      answers: { Tags: ['a', 'b'], Meta: { x: 1 } },
    };
    const csv = buildPostEventResponsesCsv([withComplex], [{ label: 'Tags' }, { label: 'Meta' }]);
    const lines = csv.replace(/^﻿/, '').split('\n');
    expect(lines[1]).toContain('a; b');
    expect(lines[1]).toContain('{""x"":1}');
  });
});
