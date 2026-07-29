import { UazapiAdapter } from '@infra/integrations/uazapi.adapter';

const config = {
  get: (key: string) => {
    const map: Record<string, unknown> = {
      UAZAPI_API_URL: 'https://uaz.test',
      WA_TYPING_ENABLED: false,
    };
    return map[key];
  },
};

function makeAdapter() {
  return new UazapiAdapter(config as any);
}

describe('UazapiAdapter — fetchGroups', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna id e subject dos grupos (a partir de JID/Name)', async () => {
    const apiResponse = {
      groups: [
        { JID: '120363424826018469@g.us', Name: 'Evento VIP', extra: 'ignored' },
        { JID: '120363424826018470@g.us', Name: 'Staff' },
      ],
    };
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => apiResponse,
    })) as any;

    const result = await makeAdapter().fetchGroups('token-1');

    expect(result).toEqual([
      { id: '120363424826018469@g.us', subject: 'Evento VIP' },
      { id: '120363424826018470@g.us', subject: 'Staff' },
    ]);
  });

  it('chama /group/list com noparticipants=true e header token', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ groups: [] }) })) as any;

    await makeAdapter().fetchGroups('token-xyz');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://uaz.test/group/list?noparticipants=true',
      expect.objectContaining({ headers: expect.objectContaining({ token: 'token-xyz' }) }),
    );
  });

  it('lança erro quando Uazapi API retorna status de erro', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    })) as any;

    await expect(makeAdapter().fetchGroups('token-xyz')).rejects.toThrow(
      'Uazapi API error (401): Unauthorized',
    );
  });
});
