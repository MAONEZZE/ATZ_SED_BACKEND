import { WhatsappInstancesService } from '@application/whatsapp_instance_module/whatsapp-instances.service';
import { WhatsappInstanceEntity } from '@domain/whatsapp_instance_module/whatsapp-instance.entity';

function makeService(
  rows: Array<{ id: string; nickname: string; token: string | null }>,
  getInstanceStatus: jest.Mock = jest.fn().mockResolvedValue('connected'),
) {
  // A porta devolve entidades; o service pergunta hasToken() a elas.
  const instances = rows.map((r) => new WhatsappInstanceEntity(r.id, r.nickname, r.token));
  const repo = { list: jest.fn().mockResolvedValue(instances) };
  const whatsapp = { getInstanceStatus };
  return {
    service: new WhatsappInstancesService(repo as any, {} as any, whatsapp as any),
    repo,
    whatsapp,
  };
}

describe('WhatsappInstancesService — list (active = conexão real via /instance/status)', () => {
  it('active=true quando status "connected", sem vazar token', async () => {
    const getStatus = jest.fn().mockResolvedValue('connected');
    const { service } = makeService(
      [{ id: 'a', nickname: 'Alpha', token: '550e8400-e29b-41d4-a716-446655440000' }],
      getStatus,
    );

    const result = await service.list();

    expect(getStatus).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
    expect(result).toEqual([{ id: 'a', nickname: 'Alpha', active: true }]);
    expect(result[0]).not.toHaveProperty('token');
  });

  it('active=false quando status diferente de "connected"', async () => {
    const { service } = makeService(
      [{ id: 'a', nickname: 'Alpha', token: 'tok' }],
      jest.fn().mockResolvedValue('connecting'),
    );

    const result = await service.list();

    expect(result).toEqual([{ id: 'a', nickname: 'Alpha', active: false }]);
  });

  it('active=false quando getInstanceStatus retorna null (offline/indisponível)', async () => {
    const { service } = makeService(
      [{ id: 'a', nickname: 'Alpha', token: 'tok' }],
      jest.fn().mockResolvedValue(null),
    );

    const result = await service.list();

    expect(result).toEqual([{ id: 'a', nickname: 'Alpha', active: false }]);
  });

  it('active=false e listagem não quebra quando getInstanceStatus lança', async () => {
    const { service } = makeService(
      [{ id: 'a', nickname: 'Alpha', token: 'tok' }],
      jest.fn().mockRejectedValue(new Error('network down')),
    );

    const result = await service.list();

    expect(result).toEqual([{ id: 'a', nickname: 'Alpha', active: false }]);
  });

  it('token null/vazio ⇒ active:false SEM chamar o adapter', async () => {
    const getStatus = jest.fn();
    const { service } = makeService(
      [
        { id: 'b', nickname: 'Beta', token: null },
        { id: 'c', nickname: 'Gamma', token: '   ' },
      ],
      getStatus,
    );

    const result = await service.list();

    expect(getStatus).not.toHaveBeenCalled();
    expect(result).toEqual([
      { id: 'b', nickname: 'Beta', active: false },
      { id: 'c', nickname: 'Gamma', active: false },
    ]);
  });

  it('consulta status por instância independentemente (mistura conectada/desconectada)', async () => {
    const getStatus = jest
      .fn()
      .mockResolvedValueOnce('connected')
      .mockResolvedValueOnce('disconnected');
    const { service } = makeService(
      [
        { id: 'a', nickname: 'Alpha', token: 'tok-a' },
        { id: 'b', nickname: 'Beta', token: 'tok-b' },
      ],
      getStatus,
    );

    const result = await service.list();

    expect(result).toEqual([
      { id: 'a', nickname: 'Alpha', active: true },
      { id: 'b', nickname: 'Beta', active: false },
    ]);
  });
});

// getToken passou a resolver a instância inteira (findById) em vez de um
// findTokenById dedicado — a regra "token vazio não serve" vive em hasToken().
describe('WhatsappInstancesService — getToken', () => {
  function makeWithFindById(instance: WhatsappInstanceEntity | null) {
    const repo = { findById: jest.fn().mockResolvedValue(instance) };
    return {
      service: new WhatsappInstancesService(repo as any, {} as any, {} as any),
      repo,
    };
  }

  it('returns the token of a connected instance', async () => {
    const { service, repo } = makeWithFindById(new WhatsappInstanceEntity('a', 'Alpha', 'tok-a'));

    await expect(service.getToken('a')).resolves.toBe('tok-a');
    expect(repo.findById).toHaveBeenCalledWith('a');
  });

  it('throws when the instance does not exist', async () => {
    const { service } = makeWithFindById(null);

    await expect(service.getToken('missing')).rejects.toThrow('Whatsapp instance token not found');
  });

  it('throws when the instance exists but has no token', async () => {
    const { service } = makeWithFindById(new WhatsappInstanceEntity('b', 'Beta', null));

    await expect(service.getToken('b')).rejects.toThrow('Whatsapp instance token not found');
  });

  // Token só de espaços é indistinguível de ausente para o fornecedor.
  it('throws when the token is blank', async () => {
    const { service } = makeWithFindById(new WhatsappInstanceEntity('c', 'Gamma', '   '));

    await expect(service.getToken('c')).rejects.toThrow('Whatsapp instance token not found');
  });
});
