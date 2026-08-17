import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FolderService } from '@application/folder_module/folder.service';
import { FolderEntity } from '@domain/folder_module/folder.entity';
import { FolderResourceType } from '@domain/folder_module/folder-resource-type';
import { FolderScope } from '@domain/folder_module/i-repository-folder';

const DATE = new Date('2026-08-17T12:00:00Z');

function folder(
  id: string,
  resourceType: FolderResourceType,
  eventId: string | null,
  parentId: string | null = null,
  ownerId = 'user-1',
): FolderEntity {
  return new FolderEntity(id, ownerId, `Pasta ${id}`, parentId, 0, DATE, DATE, resourceType, eventId);
}

function makeService(folders: FolderEntity[] = []) {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const repo = {
    listByScope: jest.fn().mockResolvedValue(folders),
    findById: jest.fn().mockImplementation((id: string) => Promise.resolve(byId.get(id) ?? null)),
    create: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    update: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
    delete: jest.fn().mockResolvedValue(undefined),
    reorder: jest.fn().mockResolvedValue(undefined),
  };
  return { service: new FolderService(repo as any), repo };
}

// O tipo decide onde a pasta pode morar. O banco tem o mesmo CHECK, mas lá o
// erro sairia como falha de constraint em vez de 400.
describe('FolderService scope validity', () => {
  const cases: Array<[string, FolderScope]> = [
    [
      'event folder inside an event',
      { ownerId: 'user-1', eventId: 'ev-1', resourceType: 'event' },
    ],
    [
      'automation folder outside any event',
      { ownerId: 'user-1', eventId: null, resourceType: 'automation_rule' },
    ],
  ];

  it.each(cases)('rejects creating an %s', async (_label, scope) => {
    const { service, repo } = makeService();

    await expect(service.create(scope, 'Nova')).rejects.toThrow(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it.each(cases)('rejects listing an %s', async (_label, scope) => {
    const { service, repo } = makeService();

    await expect(service.tree(scope)).rejects.toThrow(BadRequestException);
    expect(repo.listByScope).not.toHaveBeenCalled();
  });

  it.each(cases)('rejects reordering an %s', async (_label, scope) => {
    const { service, repo } = makeService();

    await expect(service.reorder(scope, ['a'])).rejects.toThrow(BadRequestException);
    expect(repo.reorder).not.toHaveBeenCalled();
  });

  // Template é o único tipo que existe nos dois escopos: global (painel do dono)
  // e criado dentro do evento.
  it('accepts a message_template folder in both scopes', async () => {
    const { service, repo } = makeService();

    await service.create({ ownerId: 'user-1', eventId: null, resourceType: 'message_template' }, 'A');
    await service.create(
      { ownerId: 'user-1', eventId: 'ev-1', resourceType: 'message_template' },
      'B',
    );

    expect(repo.create).toHaveBeenCalledTimes(2);
  });
});

describe('FolderService parent scope', () => {
  it('rejects a parent folder of another resource type', async () => {
    const { service, repo } = makeService([folder('p', 'event', null)]);

    await expect(
      service.create(
        { ownerId: 'user-1', eventId: null, resourceType: 'message_template' },
        'Nova',
        'p',
      ),
    ).rejects.toThrow(NotFoundException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects a parent folder that lives in another event', async () => {
    const { service, repo } = makeService([folder('p', 'automation_rule', 'ev-2')]);

    await expect(
      service.create(
        { ownerId: 'user-1', eventId: 'ev-1', resourceType: 'automation_rule' },
        'Nova',
        'p',
      ),
    ).rejects.toThrow(NotFoundException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('accepts a parent folder in the same scope', async () => {
    const { service, repo } = makeService([folder('p', 'automation_rule', 'ev-1')]);

    await service.create(
      { ownerId: 'user-1', eventId: 'ev-1', resourceType: 'automation_rule' },
      'Nova',
      'p',
    );

    expect(repo.create).toHaveBeenCalledWith({
      ownerId: 'user-1',
      resourceType: 'automation_rule',
      eventId: 'ev-1',
      name: 'Nova',
      parentId: 'p',
    });
  });
});

// Dentro de um evento a pasta é do evento, não de quem criou: sem isso o
// colaborador perderia a organização ao evento ser compartilhado.
describe('FolderService access inside an event', () => {
  it('accepts a folder of the event even when another profile created it', async () => {
    const { service, repo } = makeService([
      folder('f1', 'automation_rule', 'ev-1', null, 'outro-usuario'),
    ]);

    await service.update('f1', { ownerId: 'user-1', eventId: 'ev-1' }, { name: 'Renomeada' });

    expect(repo.update).toHaveBeenCalledWith('f1', { name: 'Renomeada' });
  });

  it('rejects a folder from a different event', async () => {
    const { service, repo } = makeService([folder('f1', 'automation_rule', 'ev-2')]);

    await expect(
      service.update('f1', { ownerId: 'user-1', eventId: 'ev-1' }, { name: 'x' }),
    ).rejects.toThrow(NotFoundException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  // A rota /folders não alcança pasta de evento, e a rota do evento não alcança
  // pasta de painel — os dois escopos não se cruzam.
  it('rejects a panel folder through an event route and vice-versa', async () => {
    const { service } = makeService([
      folder('panel', 'message_template', null),
      folder('inside', 'message_template', 'ev-1'),
    ]);

    await expect(
      service.delete('panel', { ownerId: 'user-1', eventId: 'ev-1' }),
    ).rejects.toThrow(NotFoundException);
    await expect(service.delete('inside', { ownerId: 'user-1', eventId: null })).rejects.toThrow(
      NotFoundException,
    );
  });
});
