import { EntityBase } from '@domain/shared/entity.base';

export type EventStatus = 'draft' | 'published' | 'cancelled' | 'ended';

const STATUS_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  draft: ['published', 'cancelled'],
  published: ['cancelled', 'ended'],
  cancelled: [],
  ended: [],
};

export class EventEntity extends EntityBase {
  constructor(
    id: string,
    public readonly ownerId: string,
    public title: string,
    public slug: string,
    public status: EventStatus,
    public coverUrl?: string,
    public location?: string,
    public capacity?: number,
    public dressCode?: string,
    public groupLink?: string,
    public eventDate?: Date,
    public whatsappInstanceId?: string,
    public whatsappToken?: string,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
    public endDate?: Date,
    public lastEditedById?: string,
    public sendToPipedrive: boolean = false,
    public recurrenceFreq?: string,
    public recurrenceInterval?: number,
    public recurrenceUntil?: Date,
  ) {
    super(id);
  }

  isEditable(): boolean {
    return this.status !== 'cancelled' && this.status !== 'ended';
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
