export type EventStatus = 'draft' | 'published' | 'cancelled' | 'ended';

const STATUS_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  draft: ['published', 'cancelled'],
  published: ['cancelled', 'ended'],
  cancelled: [],
  ended: [],
};

export class EventEntity {
  constructor(
    public readonly id: string,
    public readonly ownerId: string,
    public title: string,
    public slug: string,
    public status: EventStatus,
    public description?: string,
    public coverUrl?: string,
    public location?: string,
    public capacity?: number,
    public dressCode?: string,
    public groupLink?: string,
    public eventDate?: Date,
    public evolutionInstance?: string,
    public evolutionToken?: string,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
    public endDate?: Date,
    public postRegistrationMessage?: string,
    public lastEditedById?: string,
  ) {}

  isEditable(): boolean {
    return this.status !== 'cancelled';
  }

  canTransitionTo(next: EventStatus): boolean {
    return STATUS_TRANSITIONS[this.status].includes(next);
  }

  static generateSlug(title: string, suffix: string): string {
    const base = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${base}-${suffix}`;
  }
}
