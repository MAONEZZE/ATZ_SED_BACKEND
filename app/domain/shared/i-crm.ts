export const CRM_PORT = Symbol('CRM_PORT');

export interface CrmPayload {
  nome: string | null;
  telefone: string | null;
  email: string | null;
  titulo_evento: string;
  /** `event.eventDate` em ISO 8601 (UTC); null quando o evento não tem data. */
  data_inicio_evento: string | null;
  /** Respostas da submissão com o label do campo como chave. */
  respostas: Record<string, unknown>;
}

/**
 * Contrato de envio de contato para o CRM. Rejeita em caso de falha para que o
 * chamador registre o status do envio; manter a chamada fire-and-forget (não
 * aguardar antes de responder ao usuário) é responsabilidade do chamador.
 */
export interface CrmPort {
  send(payload: CrmPayload): Promise<void>;
}
