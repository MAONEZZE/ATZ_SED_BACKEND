import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/prisma/prisma.service';

export type PublicFormKind = 'registration' | 'post_event' | 'nps';

const PUBLIC_EVENT_SELECT = {
  id: true,
  title: true,
  slug: true,
  coverUrl: true,
  location: true,
  capacity: true,
  dressCode: true,
  eventDate: true,
  endDate: true,
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

    // description/postRegistrationMessage now live on the registration Form
    // scope, not on Event — merge them into the public payload so the
    // public page doesn't need a second round-trip.
    const form = await this.prisma.form.findUnique({
      where: { eventId_kind: { eventId: event.id, kind: 'registration' } },
      select: { description: true, postRegistrationMessage: true },
    });

    return {
      ...event,
      description: form?.description ?? null,
      postRegistrationMessage: form?.postRegistrationMessage ?? null,
    };
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
      where: { form: { eventId: event!.id, kind } },
      orderBy: { order: 'asc' },
      select: PUBLIC_FIELD_SELECT,
    });
  }

  /** Fields used to validate a public registration/post-event/NPS submission. */
  getSubmissionFields(slug: string, kind: PublicFormKind) {
    return this.prisma.formField.findMany({
      where: { form: { event: { slug }, kind } },
      select: { label: true, type: true, required: true, options: true },
    });
  }
}
