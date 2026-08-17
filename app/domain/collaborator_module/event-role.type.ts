/**
 * Papel dentro do evento. Ordem de poder: read < invited < admin.
 * O dono do evento é `admin` implícito — não tem linha em event_collaborators.
 */
export type EventRole = 'admin' | 'invited' | 'read';

const RANK: Record<EventRole, number> = { read: 0, invited: 1, admin: 2 };

/** `role` alcança o mínimo exigido? */
export function roleAtLeast(role: EventRole, minimum: EventRole): boolean {
  return RANK[role] >= RANK[minimum];
}
