import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FolderService } from '@application/folder_module/folder.service';
import { FolderEntity } from '@domain/folder_module/folder.entity';

const DATE = new Date('2026-08-14T12:00:00Z');

function folder(id: string, parentId: string | null, order = 0): FolderEntity {
  return new FolderEntity(id, 'user-1', `Pasta ${id}`, parentId, order, DATE, DATE);
}

function makeService(folders: FolderEntity[] = []) {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const repo = {
    listByOwner: jest.fn().mockResolvedValue(folders),
    findByIdForOwner: jest
      .fn()
      .mockImplementation((id: string, ownerId: string) =>
        Promise.resolve(byId.get(id)?.ownerId === ownerId ? byId.get(id) : null),
      ),
    create: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    update: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
    delete: jest.fn().mockResolvedValue(undefined),
    reorder: jest.fn().mockResolvedValue(undefined),
  };
  return { service: new FolderService(repo as any), repo };
}

describe('FolderService.tree', () => {
  it('nests children under their parent and returns only roots', async () => {
    const { service } = makeService([folder('a', null), folder('b', 'a'), folder('c', 'b')]);

    const tree = await service.tree('user-1');

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('a');
    expect(tree[0].children[0].id).toBe('b');
    expect(tree[0].children[0].children[0].id).toBe('c');
  });

  // Uma subpasta cujo pai não veio na consulta (pasta de outro dono, por
  // exemplo) não pode desaparecer da resposta.
  it('treats a folder with an unreachable parent as a root', async () => {
    const { service } = makeService([folder('orphan', 'gone')]);

    const tree = await service.tree('user-1');

    expect(tree.map((n) => n.id)).toEqual(['orphan']);
  });

  it('keeps the repository ordering among siblings', async () => {
    const { service } = makeService([folder('first', null, 0), folder('second', null, 1)]);

    const tree = await service.tree('user-1');

    expect(tree.map((n) => n.id)).toEqual(['first', 'second']);
  });
});

describe('FolderService.update guards', () => {
  it('rejects making a folder its own parent', async () => {
    const { service, repo } = makeService([folder('a', null)]);

    await expect(service.update('a', 'user-1', { parentId: 'a' })).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  // O ciclo a->b->a não é pego pela FK: sem essa guarda a árvore some da
  // listagem (nenhum dos dois vira raiz).
  it('rejects moving a folder into its own descendant', async () => {
    const { service, repo } = makeService([folder('a', null), folder('b', 'a')]);

    await expect(service.update('a', 'user-1', { parentId: 'b' })).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('accepts moving a folder to an unrelated parent', async () => {
    const { service, repo } = makeService([folder('a', null), folder('b', null)]);

    await service.update('a', 'user-1', { parentId: 'b' });

    expect(repo.update).toHaveBeenCalledWith('a', { parentId: 'b' });
  });

  it('accepts moving a folder to the root with an explicit null', async () => {
    const { service, repo } = makeService([folder('a', null), folder('b', 'a')]);

    await service.update('b', 'user-1', { parentId: null });

    expect(repo.update).toHaveBeenCalledWith('b', { parentId: null });
  });

  it('rejects a folder of another owner', async () => {
    const { service } = makeService([]);

    await expect(service.update('a', 'user-1', { name: 'x' })).rejects.toThrow(NotFoundException);
  });

  it('rejects nesting deeper than the maximum depth', async () => {
    // corrente de 10 pastas: criar dentro da última estoura o limite
    const chain = Array.from({ length: 10 }, (_, i) =>
      folder(`f${i}`, i === 0 ? null : `f${i - 1}`),
    );
    const { service, repo } = makeService(chain);

    await expect(service.create('user-1', 'Nova', 'f9')).rejects.toThrow(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('creates inside a shallow parent', async () => {
    const { service, repo } = makeService([folder('a', null)]);

    await service.create('user-1', 'Nova', 'a');

    expect(repo.create).toHaveBeenCalledWith({ ownerId: 'user-1', name: 'Nova', parentId: 'a' });
  });
});

describe('FolderService.delete', () => {
  it('checks ownership before deleting', async () => {
    const { service, repo } = makeService([]);

    await expect(service.delete('a', 'user-1')).rejects.toThrow(NotFoundException);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('deletes a folder of the owner', async () => {
    const { service, repo } = makeService([folder('a', null)]);

    await service.delete('a', 'user-1');

    expect(repo.delete).toHaveBeenCalledWith('a');
  });
});
