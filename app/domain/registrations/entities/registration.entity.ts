export type FunnelStatus =
  | 'pending'
  | 'screening'
  | 'qualification'
  | 'approved'
  | 'rejected'
  | 'waitlist';

const TRANSITIONS: Record<FunnelStatus, FunnelStatus[]> = {
  pending: ['screening', 'approved', 'rejected', 'waitlist'],
  screening: ['qualification', 'approved', 'rejected', 'waitlist'],
  qualification: ['approved', 'rejected', 'waitlist'],
  approved: [],
  rejected: [],
  waitlist: ['approved', 'rejected'],
};

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
    return TRANSITIONS[this.status].includes(next);
  }
}
