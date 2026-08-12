export const CRM_PORT = Symbol('CRM_PORT');

export interface CrmPayload {
  event: { id: string; slug: string; title: string };
  form: 'registration';
  contact: { email: string; phone: string; linkedin?: string; instagram?: string };
  answers: Record<string, unknown>;
}

/**
 * Contrato de envio de contato para o CRM. Rejeita em caso de falha para que o
 * chamador registre o status do envio; manter a chamada fire-and-forget (não
 * aguardar antes de responder ao usuário) é responsabilidade do chamador.
 */
export interface CrmPort {
  send(payload: CrmPayload): Promise<void>;
}
