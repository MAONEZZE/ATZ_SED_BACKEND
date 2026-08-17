import { EntityBase } from '@domain/shared/entity.base';

export type FunnelStatus = 'pending' | 'approved' | 'rejected';

/** Resultado do envio ao Pipedrive. `null` = o evento não pede envio. */
export type PipedriveStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export const FUNNEL_STATUSES: FunnelStatus[] = ['pending', 'approved', 'rejected'];

export class RegistrationEntity extends EntityBase {
  constructor(
    id: string,
    public readonly eventId: string,
    public readonly status: FunnelStatus,
    public readonly answers: Record<string, unknown>,
    public readonly name: string,
    public readonly email: string,
    public readonly phone: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly imageAuthorization: boolean = false,
    /** Presença no evento. `false` = não compareceu ou ainda não foi conferido. */
    public readonly attended: boolean = false,
    public readonly pipedriveStatus: PipedriveStatus | null = null,
  ) {
    super(id);
  }

  canTransitionTo(next: FunnelStatus): boolean {
    return FUNNEL_STATUSES.includes(next);
  }
}
