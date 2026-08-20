/**
 * Nova ordem do escopo depois de arrastar `itemId` para antes de `beforeId`
 * (sem `beforeId` = fim da lista). O front manda só os dois ids; a sequência
 * completa é reconstruída aqui a partir da ordem atual do banco.
 */
export function resequence(current: string[], itemId: string, beforeId?: string): string[] {
  // Soltar o item sobre ele mesmo não é "mandar para o fim": é não mexer.
  if (beforeId === itemId) return [...current];
  const without = current.filter((id) => id !== itemId);
  const target = beforeId ? without.indexOf(beforeId) : -1;
  if (target === -1) return [...without, itemId];
  return [...without.slice(0, target), itemId, ...without.slice(target)];
}
