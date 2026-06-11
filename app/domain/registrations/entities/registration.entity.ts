export type FunnelStatus =
  | 'pending'
  | 'screening'
  | 'qualification'
  | 'approved'
  | 'rejected'
  | 'waitlist';

const TRANSITIONS: Record<FunnelStatus, FunnelStatus[]> = {
  pending: ['approved', 'rejected'],
  screening: ['approved', 'rejected'],
  qualification: ['approved', 'rejected'],
  approved: ['pending', 'rejected'],
  rejected: ['pending', 'approved'],
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
