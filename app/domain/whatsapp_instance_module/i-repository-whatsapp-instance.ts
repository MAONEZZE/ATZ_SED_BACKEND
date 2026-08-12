import { WhatsappInstanceEntity } from './whatsapp-instance.entity';

export const WHATSAPP_INSTANCE_REPOSITORY_PORT = Symbol('WHATSAPP_INSTANCE_REPOSITORY_PORT');

/**
 * Sem `create`: instâncias são provisionadas do lado do fornecedor e cadastradas
 * fora do fluxo da aplicação. Só leitura.
 */
export interface WhatsappInstanceRepositoryPort {
  list(): Promise<WhatsappInstanceEntity[]>;
  findById(id: string): Promise<WhatsappInstanceEntity | null>;
}
