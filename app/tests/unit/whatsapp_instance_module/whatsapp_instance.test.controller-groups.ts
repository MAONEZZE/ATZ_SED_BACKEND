import { BadRequestException } from '@nestjs/common';
import { WhatsappController } from '@api/controllers/whatsapp_instance_module/whatsapp.controller';

function make() {
  const whatsapp = { fetchGroups: jest.fn() };
  const whatsappInstances = { getToken: jest.fn().mockResolvedValue('token-abc') };
  const user = { id: 'user-1' } as any;
  const ctrl = new WhatsappController(whatsapp as any, whatsappInstances as any);
  return { ctrl, whatsapp, whatsappInstances, user };
}

describe('WhatsappController — GET /whatsapp/groups', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolve o token da instância e retorna id e subject dos grupos', async () => {
    const { ctrl, whatsapp, whatsappInstances, user } = make();
    const groups = [
      { id: '120363424826018469@g.us', subject: 'Evento VIP' },
      { id: '120363424826018470@g.us', subject: 'Staff' },
    ];
    whatsapp.fetchGroups.mockResolvedValue(groups);

    const result = await ctrl.getGroups('instance-id-1', user);

    expect(result).toEqual(groups);
    expect(whatsappInstances.getToken).toHaveBeenCalledWith('instance-id-1', 'user-1');
    expect(whatsapp.fetchGroups).toHaveBeenCalledWith('token-abc');
  });

  it('lança BadRequestException quando instanceId está ausente', async () => {
    const { ctrl, user } = make();
    await expect(ctrl.getGroups(undefined as any, user)).rejects.toThrow(BadRequestException);
    await expect(ctrl.getGroups('', user)).rejects.toThrow(BadRequestException);
  });

  it('propaga erro da Whatsapp API', async () => {
    const { ctrl, whatsapp, user } = make();
    whatsapp.fetchGroups.mockRejectedValue(new Error('Whatsapp API error (500): Internal'));

    await expect(ctrl.getGroups('instance-id-1', user)).rejects.toThrow('Whatsapp API error (500)');
  });

  it('retorna lista vazia quando instância não tem grupos', async () => {
    const { ctrl, whatsapp, user } = make();
    whatsapp.fetchGroups.mockResolvedValue([]);

    const result = await ctrl.getGroups('instance-id-2', user);

    expect(result).toEqual([]);
    expect(whatsapp.fetchGroups).toHaveBeenCalledWith('token-abc');
  });
});
