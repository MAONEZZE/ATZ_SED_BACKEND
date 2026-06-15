export type FunnelStatus = 'pending' | 'approved' | 'rejected';

export const FUNNEL_STATUSES: FunnelStatus[] = ['pending', 'approved', 'rejected'];

export class RegistrationEntity {
  constructor(
    public readonly id: string,
    public readonly eventId: string,
    public readonly status: FunnelStatus,
    public readonly answers: Record<string, unknown>,
    public readonly name: string,
    public readonly email: string,
    public readonly phone: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  canTransitionTo(next: FunnelStatus): boolean {
    return FUNNEL_STATUSES.includes(next);
  }
}
