import { UazapiInstancesService } from '@modules/uazapi-instances/uazapi-instances.service';

function makeService(
  rows: Array<{ id: string; nickname: string; token: string | null }>,
  getInstanceStatus: jest.Mock = jest.fn().mockResolvedValue('connected'),
) {
  const repo = { list: jest.fn().mockResolvedValue(rows) };
  const uazapi = { getInstanceStatus };
  return {
    service: new UazapiInstancesService(repo as any, {} as any, uazapi as any),
    repo,
    uazapi,
  };
}

describe('UazapiInstancesService — list (active = conexão real via /instance/status)', () => {
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
