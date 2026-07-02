import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/prisma/prisma.service';

export type PublicFormKind = 'registration' | 'post_event' | 'nps';

const PUBLIC_EVENT_SELECT = {
  id: true,
  title: true,
  slug: true,
  description: true,
  coverUrl: true,
  location: true,
  capacity: true,
  dressCode: true,
  eventDate: true,
  endDate: true,
  postRegistrationMessage: true,
  sendToPipedrive: true,
  status: true,
} as const;

const PUBLIC_FIELD_SELECT = {
  id: true,
  label: true,
  type: true,
  required: true,
  options: true,
  order: true,
} as const;

/**
 * Read-only queries backing the public (unauthenticated) event pages.
 * Centralizes the "is this event visible?" gating that was copy-pasted across
 * the public controllers.
 */
@Injectable()
export class PublicEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicEvent(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      select: PUBLIC_EVENT_SELECT,
    });
    if (!event || (event.status !== 'published' && event.status !== 'ended')) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  /**
   * Returns the form fields of a given kind for a public event.
   * Registration fields are visible only while `published`; post-event/NPS
   * fields (`allowEnded`) stay visible after the event has `ended`.
   */
  async getPublicFormFields(slug: string, kind: PublicFormKind, allowEnded: boolean) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });
    const visible =
      !!event && (event.status === 'published' || (allowEnded && event.status === 'ended'));
    if (!visible) throw new NotFoundException('Event not found');

    return this.prisma.formField.findMany({
      where: { eventId: event!.id, kind },
      orderBy: { order: 'asc' },
      select: PUBLIC_FIELD_SELECT,
    });
  }

  /** Fields (label + required) used to validate a public NPS/post-event submission. */
  getSubmissionFields(slug: string, kind: 'post_event' | 'nps') {
    return this.prisma.formField.findMany({
      where: { event: { slug }, kind },
      select: { label: true, required: true },
    });
  }
}
