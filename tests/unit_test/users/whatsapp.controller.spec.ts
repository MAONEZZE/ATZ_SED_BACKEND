import { BadRequestException } from '@nestjs/common';
import { WhatsappController } from '@modules/whatsapp-instances/whatsapp.controller';

function make() {
  const whatsapp = { fetchGroups: jest.fn() };
  const whatsappInstances = { getToken: jest.fn().mockResolvedValue('token-abc') };
  const ctrl = new WhatsappController(whatsapp as any, whatsappInstances as any);
  return { ctrl, whatsapp, whatsappInstances };
}

describe('WhatsappController — GET /whatsapp/groups', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolve o token da instância e retorna id e subject dos grupos', async () => {
    const { ctrl, whatsapp, whatsappInstances } = make();
    const groups = [
      { id: '120363424826018469@g.us', subject: 'Evento VIP' },
      { id: '120363424826018470@g.us', subject: 'Staff' },
    ];
    whatsapp.fetchGroups.mockResolvedValue(groups);

    const result = await ctrl.getGroups('instance-id-1');

    expect(result).toEqual(groups);
    expect(whatsappInstances.getToken).toHaveBeenCalledWith('instance-id-1');
    expect(whatsapp.fetchGroups).toHaveBeenCalledWith('token-abc');
  });

  it('lança BadRequestException quando instanceId está ausente', async () => {
    const { ctrl } = make();
    await expect(ctrl.getGroups(undefined as any)).rejects.toThrow(BadRequestException);
    await expect(ctrl.getGroups('')).rejects.toThrow(BadRequestException);
  });

  it('propaga erro da Whatsapp API', async () => {
    const { ctrl, whatsapp } = make();
    whatsapp.fetchGroups.mockRejectedValue(new Error('Whatsapp API error (500): Internal'));

    await expect(ctrl.getGroups('instance-id-1')).rejects.toThrow('Whatsapp API error (500)');
  });

  it('retorna lista vazia quando instância não tem grupos', async () => {
    const { ctrl, whatsapp } = make();
    whatsapp.fetchGroups.mockResolvedValue([]);

    const result = await ctrl.getGroups('instance-id-2');

    expect(result).toEqual([]);
    expect(whatsapp.fetchGroups).toHaveBeenCalledWith('token-abc');
  });
});
