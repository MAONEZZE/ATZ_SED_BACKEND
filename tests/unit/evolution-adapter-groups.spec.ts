import { EvolutionAdapter } from '../../app/database/integrations/evolution.adapter';

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

describe('EvolutionAdapter — fetchGroups', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna id e subject dos grupos', async () => {
    const apiResponse = [
      { id: '120363424826018469@g.us', subject: 'Evento VIP', extra: 'ignored' },
      { id: '120363424826018470@g.us', subject: 'Staff' },
    ];
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => apiResponse,
    })) as any;

    const result = await makeAdapter().fetchGroups('minha-instancia');

    expect(result).toEqual([
      { id: '120363424826018469@g.us', subject: 'Evento VIP' },
      { id: '120363424826018470@g.us', subject: 'Staff' },
    ]);
  });

  it('chama a URL correta com getParticipants=false', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => [] })) as any;

    await makeAdapter().fetchGroups('inst-xyz');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://evo.test/group/fetchAllGroups/inst-xyz?getParticipants=false',
      expect.objectContaining({ headers: expect.objectContaining({ apikey: 'key-123' }) }),
    );
  });

  it('lança erro quando Evolution API retorna status de erro', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    })) as any;

    await expect(makeAdapter().fetchGroups('inst-xyz')).rejects.toThrow(
      'Evolution API error (401): Unauthorized',
    );
  });
});
