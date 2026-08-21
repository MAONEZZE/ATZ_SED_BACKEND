import { ConflictException } from '@nestjs/common';
import { MessageTemplateService } from '@application/message_template_module/message-template.service';

const EXISTING = { id: 'tpl-1', channel: 'whatsapp', subject: null, eventId: null, folderId: null };

function make(rule: { id: string; eventId: string; trigger: string } | null = null) {
  const repo = {
    findByIdForUser: jest.fn().mockResolvedValue(EXISTING),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const folders = { findById: jest.fn().mockResolvedValue(null) };
  const automations = { findActiveRuleByTemplate: jest.fn().mockResolvedValue(rule) };
  const svc = new MessageTemplateService(repo as any, folders as any, automations as any);
  return { svc, repo, automations };
}

describe('MessageTemplateService.delete — guarda contra automação ativa', () => {
  it('409s quando o template está em uso por uma regra ativa', async () => {
    const { svc, repo } = make({ id: 'rule-1', eventId: 'evt-1', trigger: 'on_approval' });

    await expect(svc.delete('user-1', 'tpl-1')).rejects.toThrow(ConflictException);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('apaga quando não há regra ativa usando o template', async () => {
    const { svc, repo } = make(null);

    await svc.delete('user-1', 'tpl-1');

    expect(repo.delete).toHaveBeenCalledWith('tpl-1');
  });
});
