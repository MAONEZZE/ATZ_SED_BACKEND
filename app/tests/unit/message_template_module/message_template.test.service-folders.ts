import { NotFoundException } from '@nestjs/common';
import { MessageTemplateService } from '@application/message_template_module/message-template.service';

const GLOBAL_FOLDER = {
  id: 'fld-global',
  ownerId: 'user-1',
  resourceType: 'message_template' as const,
  eventId: null,
};
const EVENT_FOLDER = {
  id: 'fld-ev1',
  ownerId: 'user-1',
  resourceType: 'message_template' as const,
  eventId: 'evt-1',
};

const EXISTING = {
  id: 'tpl-1',
  channel: 'whatsapp',
  subject: null,
  eventId: null,
  folderId: null,
};

function make(folder: unknown = GLOBAL_FOLDER, existing: object = EXISTING) {
  const repo = {
    create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'tpl-1', ...data })),
    update: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
    findByIdForUser: jest.fn().mockResolvedValue(existing),
    eventAccessible: jest.fn().mockResolvedValue(true),
    reorder: jest.fn().mockResolvedValue(undefined),
  };
  const folders = { findById: jest.fn().mockResolvedValue(folder) };
  const automations = { findActiveRuleByTemplate: jest.fn().mockResolvedValue(null) };
  return {
    svc: new MessageTemplateService(repo as any, folders as any, automations as any),
    repo,
    folders,
  };
}

describe('MessageTemplateService.create folderId', () => {
  it('stores a global folder on a global template', async () => {
    const { svc, repo } = make();

    await svc.create('user-1', {
      name: 'A',
      channel: 'whatsapp',
      body: 'x',
      folderId: 'fld-global',
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ folderId: 'fld-global', eventId: null }),
    );
  });

  it('rejects a folder of another resource type', async () => {
    const { svc, repo } = make({ ...GLOBAL_FOLDER, resourceType: 'event' });

    await expect(
      svc.create('user-1', { name: 'A', channel: 'whatsapp', body: 'x', folderId: 'fld-global' }),
    ).rejects.toThrow(NotFoundException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects a panel folder of another owner', async () => {
    const { svc, repo } = make({ ...GLOBAL_FOLDER, ownerId: 'user-2' });

    await expect(
      svc.create('user-1', { name: 'A', channel: 'whatsapp', body: 'x', folderId: 'fld-global' }),
    ).rejects.toThrow(NotFoundException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  // A invariante central: pasta e template no MESMO escopo de evento.
  it('rejects an event folder on a global template', async () => {
    const { svc, repo } = make(EVENT_FOLDER);

    await expect(
      svc.create('user-1', { name: 'A', channel: 'whatsapp', body: 'x', folderId: 'fld-ev1' }),
    ).rejects.toThrow(NotFoundException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects a global folder on an event template', async () => {
    const { svc, repo } = make(GLOBAL_FOLDER);

    await expect(
      svc.create('user-1', {
        name: 'A',
        channel: 'whatsapp',
        body: 'x',
        eventId: 'evt-1',
        folderId: 'fld-global',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects a folder from another event', async () => {
    const { svc, repo } = make({ ...EVENT_FOLDER, eventId: 'evt-9' });

    await expect(
      svc.create('user-1', {
        name: 'A',
        channel: 'whatsapp',
        body: 'x',
        eventId: 'evt-1',
        folderId: 'fld-ev1',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe('MessageTemplateService.update folderId', () => {
  it('leaves the column alone when folderId is absent and the event did not change', async () => {
    const { svc, repo } = make();

    await svc.update('user-1', 'tpl-1', { name: 'Novo nome' });

    expect(repo.update.mock.calls[0][1]).not.toHaveProperty('folderId');
  });

  it('clears the folder with an explicit null without touching the folder repo', async () => {
    const { svc, repo, folders } = make();

    await svc.update('user-1', 'tpl-1', { folderId: null });

    expect(repo.update).toHaveBeenCalledWith('tpl-1', { folderId: null });
    expect(folders.findById).not.toHaveBeenCalled();
  });

  // Sem isso o template sairia do evento mas continuaria dentro de uma pasta
  // daquele evento — pasta e template em escopos diferentes.
  it('clears the folder when the template leaves its event and no folder is given', async () => {
    const { svc, repo } = make(EVENT_FOLDER, {
      ...EXISTING,
      eventId: 'evt-1',
      folderId: 'fld-ev1',
    });

    await svc.update('user-1', 'tpl-1', { eventId: null });

    expect(repo.update).toHaveBeenCalledWith(
      'tpl-1',
      expect.objectContaining({ eventId: null, folderId: null }),
    );
  });

  it('does not clear the folder when the event stays the same', async () => {
    const { svc, repo } = make(EVENT_FOLDER, {
      ...EXISTING,
      eventId: 'evt-1',
      folderId: 'fld-ev1',
    });

    await svc.update('user-1', 'tpl-1', { eventId: 'evt-1', name: 'x' });

    expect(repo.update.mock.calls[0][1]).not.toHaveProperty('folderId');
  });

  // A validação vale sobre a mesclagem: o eventId novo do patch é o que conta.
  it('validates the new folder against the incoming eventId', async () => {
    const { svc, repo } = make(EVENT_FOLDER);

    await svc.update('user-1', 'tpl-1', { eventId: 'evt-1', folderId: 'fld-ev1' });

    expect(repo.update).toHaveBeenCalledWith(
      'tpl-1',
      expect.objectContaining({ eventId: 'evt-1', folderId: 'fld-ev1' }),
    );
  });

  it('rejects a folder that does not match the resulting event', async () => {
    const { svc, repo } = make(GLOBAL_FOLDER);

    await expect(
      svc.update('user-1', 'tpl-1', { eventId: 'evt-1', folderId: 'fld-global' }),
    ).rejects.toThrow(NotFoundException);
    expect(repo.update).not.toHaveBeenCalled();
  });
});

describe('MessageTemplateService.reorder', () => {
  it('reorders templates outside any folder without a folder lookup', async () => {
    const { svc, repo, folders } = make();

    await svc.reorder('user-1', null, ['b', 'a']);

    expect(folders.findById).not.toHaveBeenCalled();
    expect(repo.reorder).toHaveBeenCalledWith('user-1', null, ['b', 'a']);
  });

  it('checks the folder before reordering inside it', async () => {
    const { svc, repo } = make();

    await svc.reorder('user-1', 'fld-global', ['b', 'a']);

    expect(repo.reorder).toHaveBeenCalledWith('user-1', 'fld-global', ['b', 'a']);
  });

  it('rejects reordering inside a folder of another type', async () => {
    const { svc, repo } = make({ ...GLOBAL_FOLDER, resourceType: 'automation_rule' });

    await expect(svc.reorder('user-1', 'fld-global', ['b'])).rejects.toThrow(NotFoundException);
    expect(repo.reorder).not.toHaveBeenCalled();
  });
});
