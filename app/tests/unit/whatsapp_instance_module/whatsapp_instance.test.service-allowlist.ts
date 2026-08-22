import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { WhatsappInstanceService } from '@application/whatsapp_instance_module/whatsapp-instance.service';
import { WhatsappInstanceEntity } from '@domain/whatsapp_instance_module/whatsapp-instance.entity';

function makeService(allowed: boolean, forProfile: WhatsappInstanceEntity[] = []) {
  const repo = {
    list: jest.fn().mockResolvedValue([]),
    listForProfile: jest.fn().mockResolvedValue(forProfile),
    findById: jest.fn().mockResolvedValue(new WhatsappInstanceEntity('inst-1', 'Alpha', 'tok-1')),
    isAllowedForProfile: jest.fn().mockResolvedValue(allowed),
  };
  const whatsapp = {
    getInstanceStatus: jest.fn().mockResolvedValue('connected'),
    setWebhook: jest.fn().mockResolvedValue(undefined),
  };
  const config = { get: jest.fn().mockReturnValue('https://app.test') };
  return {
    service: new WhatsappInstanceService(repo as any, config as any, whatsapp as any),
    repo,
    whatsapp,
  };
}

describe('WhatsappInstanceService allow list', () => {
  // A listagem passa a ser por usuário: nunca mais devolve o parque inteiro.
  it('lists only the instances allowed for the profile', async () => {
    const { service, repo } = makeService(true, [
      new WhatsappInstanceEntity('inst-1', 'Alpha', 'tok-1'),
    ]);

    const result = await service.list('user-1');

    expect(repo.listForProfile).toHaveBeenCalledWith('user-1');
    expect(repo.list).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: 'inst-1', nickname: 'Alpha', active: true }]);
  });

  it('returns an empty list when the profile has no instance released', async () => {
    const { service } = makeService(true, []);

    await expect(service.list('user-1')).resolves.toEqual([]);
  });

  it('refuses the token of an instance outside the profile list', async () => {
    const { service, repo } = makeService(false);

    await expect(service.getToken('inst-1', 'user-1')).rejects.toThrow(ForbiddenException);
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('returns the token when the instance is allowed', async () => {
    const { service } = makeService(true);

    await expect(service.getToken('inst-1', 'user-1')).resolves.toBe('tok-1');
  });

  // Sem profileId é uso interno (worker/webhook), onde não existe usuário na
  // requisição — a checagem não se aplica.
  it('skips the check when no profile is given', async () => {
    const { service, repo } = makeService(false);

    await expect(service.getToken('inst-1')).resolves.toBe('tok-1');
    expect(repo.isAllowedForProfile).not.toHaveBeenCalled();
  });

  it('still 404s an allowed instance without a token', async () => {
    const { service, repo } = makeService(true);
    repo.findById.mockResolvedValue(new WhatsappInstanceEntity('inst-1', 'Alpha', null));

    await expect(service.getToken('inst-1', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('refuses to register a webhook on an instance outside the list', async () => {
    const { service, whatsapp } = makeService(false);

    await expect(service.registerWebhook('inst-1', 'user-1')).rejects.toThrow(ForbiddenException);
    expect(whatsapp.setWebhook).not.toHaveBeenCalled();
  });
});
