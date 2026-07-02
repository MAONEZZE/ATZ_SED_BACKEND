import { BadRequestException } from '@nestjs/common';
import { WhatsappController } from '../../../app/api/controllers/users/users_routes/whatsapp.controller';

function make() {
  const evolution = { fetchGroups: jest.fn() };
  const ctrl = new WhatsappController(evolution as any);
  return { ctrl, evolution };
}

describe('WhatsappController — GET /whatsapp/groups', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna id e subject dos grupos da instância', async () => {
    const { ctrl, evolution } = make();
    const groups = [
      { id: '120363424826018469@g.us', subject: 'Evento VIP' },
      { id: '120363424826018470@g.us', subject: 'Staff' },
    ];
    evolution.fetchGroups.mockResolvedValue(groups);

    const result = await ctrl.getGroups('minha-instancia');

    expect(result).toEqual(groups);
    expect(evolution.fetchGroups).toHaveBeenCalledWith('minha-instancia');
  });

  it('lança BadRequestException quando instancia está ausente', async () => {
    const { ctrl } = make();
    await expect(ctrl.getGroups(undefined as any)).rejects.toThrow(BadRequestException);
    await expect(ctrl.getGroups('')).rejects.toThrow(BadRequestException);
  });

  it('propaga erro da Evolution API', async () => {
    const { ctrl, evolution } = make();
    evolution.fetchGroups.mockRejectedValue(new Error('Evolution API error (500): Internal'));

    await expect(ctrl.getGroups('inst-xyz')).rejects.toThrow('Evolution API error (500)');
  });

  it('retorna lista vazia quando instância não tem grupos', async () => {
    const { ctrl, evolution } = make();
    evolution.fetchGroups.mockResolvedValue([]);

    const result = await ctrl.getGroups('inst-sem-grupos');

    expect(result).toEqual([]);
    expect(evolution.fetchGroups).toHaveBeenCalledWith('inst-sem-grupos');
  });
});
