import { BadRequestException } from '@nestjs/common';
import { MessageTemplateService } from '@application/message_template_module/message-template.service';

const EXISTING = {
  id: 'tpl-1',
  channel: 'whatsapp',
  subject: null,
  eventId: 'evt-1',
  folderId: null,
};

function make(hasRule: boolean) {
  const repo = {
    findByIdForUser: jest.fn().mockResolvedValue(EXISTING),
    eventAccessible: jest.fn().mockResolvedValue(true),
    update: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
  };
  const folders = { findById: jest.fn().mockResolvedValue(null) };
  const automations = {
    findActiveRuleByTemplate: jest.fn().mockResolvedValue(null),
    hasRuleForTemplate: jest.fn().mockResolvedValue(hasRule),
  };
  const svc = new MessageTemplateService(repo as any, folders as any, automations as any, {} as any);
  return { svc, repo, automations };
}

// Trocar o eventId de um template com automação (ativa ou não) deixaria a
// regra com um templateId que já não pertence ao evento dela — e automação só
// usa template do próprio evento.
describe('MessageTemplateService.update — guarda contra trocar eventId de template em uso', () => {
  it('400s trocando eventId de template com automação (mesmo inativa)', async () => {
    const { svc, repo, automations } = make(true);

    await expect(svc.update('user-1', 'tpl-1', { eventId: 'evt-2' })).rejects.toThrow(
      BadRequestException,
    );
    expect(automations.hasRuleForTemplate).toHaveBeenCalledWith('tpl-1');
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('400s desvinculando (eventId: null) um template com automação', async () => {
    const { svc, repo } = make(true);

    await expect(svc.update('user-1', 'tpl-1', { eventId: null })).rejects.toThrow(
      BadRequestException,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('troca o eventId normalmente quando o template não tem regra', async () => {
    const { svc, repo } = make(false);

    await svc.update('user-1', 'tpl-1', { eventId: 'evt-2' });

    expect(repo.update).toHaveBeenCalledWith(
      'tpl-1',
      expect.objectContaining({ eventId: 'evt-2' }),
    );
  });

  it('um PATCH que não toca eventId passa mesmo com o template em uso', async () => {
    const { svc, repo, automations } = make(true);

    await svc.update('user-1', 'tpl-1', { name: 'Novo nome' });

    expect(automations.hasRuleForTemplate).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith(
      'tpl-1',
      expect.objectContaining({ name: 'Novo nome' }),
    );
  });
});
