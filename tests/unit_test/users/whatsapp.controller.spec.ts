import { BadRequestException } from '@nestjs/common';
import { WhatsappController } from '@modules/users/whatsapp.controller';

function make() {
  const uazapi = { fetchGroups: jest.fn() };
  const uazapiInstances = { getToken: jest.fn().mockResolvedValue('token-abc') };
  const ctrl = new WhatsappController(uazapi as any, uazapiInstances as any);
  return { ctrl, uazapi, uazapiInstances };
}

describe('WhatsappController — GET /whatsapp/groups', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolve o token da instância e retorna id e subject dos grupos', async () => {
    const { ctrl, uazapi, uazapiInstances } = make();
    const groups = [
      { id: '120363424826018469@g.us', subject: 'Evento VIP' },
      { id: '120363424826018470@g.us', subject: 'Staff' },
    ];
    uazapi.fetchGroups.mockResolvedValue(groups);

    const result = await ctrl.getGroups('instance-id-1');

    expect(result).toEqual(groups);
    expect(uazapiInstances.getToken).toHaveBeenCalledWith('instance-id-1');
    expect(uazapi.fetchGroups).toHaveBeenCalledWith('token-abc');
  });

  it('lança BadRequestException quando instanceId está ausente', async () => {
    const { ctrl } = make();
    await expect(ctrl.getGroups(undefined as any)).rejects.toThrow(BadRequestException);
    await expect(ctrl.getGroups('')).rejects.toThrow(BadRequestException);
  });

  it('propaga erro da Uazapi API', async () => {
    const { ctrl, uazapi } = make();
    uazapi.fetchGroups.mockRejectedValue(new Error('Uazapi API error (500): Internal'));

    await expect(ctrl.getGroups('instance-id-1')).rejects.toThrow('Uazapi API error (500)');
  });

  it('retorna lista vazia quando instância não tem grupos', async () => {
    const { ctrl, uazapi } = make();
    uazapi.fetchGroups.mockResolvedValue([]);

    const result = await ctrl.getGroups('instance-id-2');

    expect(result).toEqual([]);
    expect(uazapi.fetchGroups).toHaveBeenCalledWith('token-abc');
  });
});
