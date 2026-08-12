import { ValidatorBase } from '@domain/shared/validator.base';
import { MessageChannel } from '@domain/shared/message-channel.type';
import { MessageTemplateEntity } from './message-template.entity';

export interface MessageTemplateInput {
  channel: MessageChannel;
  subject?: string | null;
}

/**
 * Invariantes de um template. Numa edição parcial, os valores passados aqui
 * devem ser o **resultado da mesclagem** com o template existente — trocar só o
 * canal para email também precisa de assunto.
 */
export class MessageTemplateValidator extends ValidatorBase<MessageTemplateInput> {
  validate(input: MessageTemplateInput): string[] {
    if (MessageTemplateEntity.requiresSubject(input.channel, input.subject)) {
      return ['subject é obrigatório para templates de email'];
    }
    return [];
  }
}
