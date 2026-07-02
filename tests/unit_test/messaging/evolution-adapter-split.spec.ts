import { EvolutionAdapter } from '@infra/integrations/evolution.adapter';

// ConfigService falso: typing desabilitado para envios determinísticos (sem delay aleatório).
const config = {
  get: (key: string) => {
    const map: Record<string, unknown> = {
      EVOLUTION_API_URL: 'https://evo.test',
      EVOLUTION_API_KEY: 'key-123',
      WA_TYPING_ENABLED: false,
    };
    return map[key];
  },
};

function makeAdapter() {
  return new EvolutionAdapter(config as any);
}

// Captura os textos enviados em cada POST ao Evolution.
function mockFetchOk() {
  const sentTexts: string[] = [];
  const fetchMock = jest.fn(async (_url: string, init: { body: string }) => {
    const payload = JSON.parse(init.body) as { text: string };
    sentTexts.push(payload.text);
    return { ok: true, text: async () => '' } as any;
  });
  global.fetch = fetchMock as any;
  return { sentTexts, fetchMock };
}

describe('EvolutionAdapter — split de mensagens em \\n\\n', () => {
  beforeEach(() => jest.clearAllMocks());

  // Cenário 1: sem \n\n → uma única mensagem (comportamento atual preservado).
  it('envia corpo sem \\n\\n como uma única mensagem', async () => {
    const { sentTexts, fetchMock } = mockFetchOk();
    await makeAdapter().sendWhatsApp('inst', '5511999', 'Olá, tudo bem?');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentTexts).toEqual(['Olá, tudo bem?']);
  });

  // Cenário 2: corpo com \n\n → uma mensagem por parte, na ordem.
  it('quebra corpo com \\n\\n em várias mensagens, na ordem', async () => {
    const { sentTexts, fetchMock } = mockFetchOk();
    await makeAdapter().sendWhatsApp('inst', '5511999', 'Parte 1\n\nParte 2\n\nParte 3');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sentTexts).toEqual(['Parte 1', 'Parte 2', 'Parte 3']);
  });

  // Cenário 3: múltiplas linhas em branco / whitespace → colapsa, trim, sem partes vazias.
  it('colapsa linhas em branco extras e ignora partes vazias', async () => {
    const { sentTexts, fetchMock } = mockFetchOk();
    await makeAdapter().sendWhatsApp('inst', '5511999', '  Bom dia  \n\n\n\n  Tudo certo?  \n\n   ');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentTexts).toEqual(['Bom dia', 'Tudo certo?']);
  });

  // Cenário 4: startIndex pula partes já enviadas (retry após falha parcial).
  it('pula partes já enviadas quando startIndex > 0', async () => {
    const { sentTexts, fetchMock } = mockFetchOk();
    await makeAdapter().sendWhatsApp('inst', '5511999', 'A\n\nB\n\nC', { startIndex: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentTexts).toEqual(['C']);
  });

  // Cenário 5: onPartSent é chamado após cada parte, com índice crescente (persistência de progresso).
  it('chama onPartSent com o índice após cada parte entregue', async () => {
    mockFetchOk();
    const indices: number[] = [];
    await makeAdapter().sendWhatsApp('inst', '5511999', 'X\n\nY\n\nZ', {
      onPartSent: (i: number) => {
        indices.push(i);
      },
    });

    expect(indices).toEqual([0, 1, 2]);
  });
});
