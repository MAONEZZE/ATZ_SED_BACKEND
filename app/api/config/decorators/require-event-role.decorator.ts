import { SetMetadata } from '@nestjs/common';
import { EventRole } from '@domain/collaborator_module/event-role.type';

export const EVENT_ROLE_KEY = 'requiredEventRole';

/**
 * Papel **mínimo** exigido na rota (read < invited < admin). Sem o decorator, o
 * OwnershipGuard deriva do verbo HTTP: GET exige `read`, qualquer escrita exige
 * `invited`. Use o decorator só onde a regra foge disso:
 *   - `admin` para gerenciar colaboradores;
 *   - `read` no DELETE do evento, que qualquer papel pode chamar (para invited e
 *     read ele apenas desvincula, em vez de apagar).
 */
export const RequireEventRole = (role: EventRole) => SetMetadata(EVENT_ROLE_KEY, role);
