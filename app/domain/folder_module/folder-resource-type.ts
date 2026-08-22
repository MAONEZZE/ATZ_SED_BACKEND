/**
 * Que tipo de registro uma pasta organiza. Uma pasta serve a um tipo só — não
 * existe pasta mista, e nenhuma consulta atravessa tipos.
 *
 * O tipo também determina o escopo permitido (`Folder.eventId`):
 *   event            → pasta do painel do dono, nunca dentro de um evento
 *   automation_rule  → sempre dentro de um evento (a regra só existe lá)
 *   message_template → os dois casos (template global x template do evento)
 */
export const FOLDER_RESOURCE_TYPES = ['event', 'message_template', 'automation_rule'] as const;

export type FolderResourceType = (typeof FOLDER_RESOURCE_TYPES)[number];
