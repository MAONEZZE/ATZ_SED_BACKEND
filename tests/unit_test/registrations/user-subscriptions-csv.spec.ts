import { buildUserSubscriptionsCsv } from '@services/registrations/user-subscriptions-csv';

describe('buildUserSubscriptionsCsv', () => {
  const fields = {
    registration: [{ label: 'Empresa' }],
    postEvent: [{ label: 'Comentário' }],
    nps: [{ label: 'Nota (0-10)' }, { label: 'Fotos' }],
  };

  const rows = [
    {
      name: 'João',
      email: 'joao@b.com',
      phone: '11999990000',
      sendToPipedrive: true,
      pipedriveStatus: 'sent' as const,
      createdAt: new Date('2026-06-22T19:00:00.000Z'), // 16:00 BRT
      updatedAt: new Date('2026-06-22T19:30:00.000Z'), // 16:30 BRT
      registrationAnswers: { Empresa: 'ACME' },
      postEventAnswers: null,
      npsAnswers: { 'Nota (0-10)': '9', Fotos: ['http://img/1', 'http://img/2'] },
    },
  ];

  it('builds header with fixed + prefixed dynamic columns', () => {
    const csv = buildUserSubscriptionsCsv(rows, fields);
    const header = csv.replace(/^﻿/, '').split('\n')[0];
    expect(header).toBe(
      'Nome,E-mail,Telefone,Enviar Pipedrive,Status Pipedrive,Criado em,Atualizado em,' +
        'Inscrição: Empresa,Pós-evento: Comentário,NPS: Nota (0-10),NPS: Fotos',
    );
  });

  it('starts with UTF-8 BOM', () => {
    expect(buildUserSubscriptionsCsv(rows, fields).startsWith('﻿')).toBe(true);
  });

  it('formats dates in America/Sao_Paulo and renders the row', () => {
    const csv = buildUserSubscriptionsCsv(rows, fields);
    const dataRow = csv.replace(/^﻿/, '').split('\n')[1];
    // Nome,E-mail,Telefone,sim,sent,Criado,Atualizado,Empresa,(pós vazio),Nota,Fotos
    expect(dataRow).toBe(
      'João,joao@b.com,11999990000,sim,sent,22/06/2026 16:00,22/06/2026 16:30,' +
        'ACME,,9,http://img/1; http://img/2',
    );
  });

  it('renders "não" and empty status when not sending to pipedrive', () => {
    const csv = buildUserSubscriptionsCsv(
      [{ ...rows[0], sendToPipedrive: false, pipedriveStatus: null }],
      fields,
    );
    const dataRow = csv.replace(/^﻿/, '').split('\n')[1];
    expect(dataRow).toContain(',não,,'); // enviar=não, status vazio
  });
});
