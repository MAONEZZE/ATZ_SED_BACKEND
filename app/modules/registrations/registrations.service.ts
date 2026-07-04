import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  REGISTRATION_REPOSITORY_PORT,
  RegistrationRepositoryPort,
} from '@modules/registrations/ports/registration-repository.port';
import {
  RegistrationEntity,
  FunnelStatus,
} from '@modules/registrations/entities/registration.entity';
import { RegistrationStatusChanged } from '@modules/registrations/entities/registration-status-changed.event';
import { FormSubmitted } from '@modules/registrations/entities/form-submitted.event';
import { EventsService } from '@modules/events/events.service';
import { UserSubscriptionsService } from './user-subscriptions.service';
import { PipedriveAdapter } from '@infra/integrations/pipedrive.adapter';
import { validateAnswers, AnswerFieldMeta } from './answer-validation';

@Injectable()
export class RegistrationsService {
  private readonly logger = new Logger(RegistrationsService.name);

  constructor(
    @Inject(REGISTRATION_REPOSITORY_PORT)
    private readonly regRepo: RegistrationRepositoryPort,
    private readonly eventsService: EventsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly userSubscriptions: UserSubscriptionsService,
    private readonly pipedrive: PipedriveAdapter,
  ) {}

  async createPublic(
    slug: string,
    answers: Record<string, unknown>,
    fields: AnswerFieldMeta[],
    sendToPipedrive?: boolean,
  ): Promise<RegistrationEntity> {
    const event = await this.eventsService.findBySlug(slug);
    if (event.status !== 'published') {
      throw new BadRequestException('Event is not accepting registrations');
    }

    validateAnswers(fields, answers);

    if (event.capacity != null) {
      const currentCount = await this.regRepo.countByEvent(event.id);
      if (currentCount >= event.capacity) {
        throw new BadRequestException('Event has reached its registration capacity');
      }
    }

    // Body flag overrides; otherwise fall back to the event-level default.
    const shouldSendToPipedrive = sendToPipedrive ?? event.sendToPipedrive;

    const name = this.extractString(answers, ['nome', 'name']);
    const email = this.extractString(answers, ['email']);
    const phone = this.extractString(answers, ['telefone', 'phone']);

    const reg = await this.regRepo.create({ eventId: event.id, answers, name, email, phone });

    this.eventEmitter.emit(
      'registration.status_changed',
      new RegistrationStatusChanged(reg.id, event.id, 'pending', 'pending', event.ownerId),
    );

    const subscription = await this.userSubscriptions.upsertFromForm(
      event.id,
      'registration',
      answers,
    );

    if (shouldSendToPipedrive) {
      await this.userSubscriptions.markPipedrive(subscription.id, true, 'pending');
      // Fire-and-forget: don't block the response on the webhook; record the
      // outcome asynchronously.
      void this.pipedrive
        .send({
          event: { id: event.id, slug: event.slug, title: event.title },
          form: 'registration',
          contact: { name, email, phone },
          answers,
        })
        .then(() => this.userSubscriptions.markPipedrive(subscription.id, true, 'sent'))
        .catch((err) => {
          this.logger.error({ err, eventId: event.id }, 'Pipedrive webhook error');
          return this.userSubscriptions.markPipedrive(subscription.id, true, 'failed');
        });
    } else {
      await this.userSubscriptions.markPipedrive(subscription.id, false, 'skipped');
    }

    return reg;
  }

  async findAll(
    eventId: string,
    status?: FunnelStatus,
    search?: string,
  ): Promise<RegistrationEntity[]> {
    return this.regRepo.findAllByEvent(eventId, status, search);
  }

  async findAllPaginated(
    eventId: string,
    page: number,
    limit: number,
    status?: FunnelStatus,
    search?: string,
  ): Promise<{ data: RegistrationEntity[]; total: number }> {
    return this.regRepo.findAllByEventPaginated(
      eventId,
      { skip: (page - 1) * limit, take: limit },
      status,
      search,
    );
  }

  async findById(id: string, eventId: string): Promise<RegistrationEntity> {
    const reg = await this.regRepo.findById(id);
    if (!reg || reg.eventId !== eventId) {
      throw new NotFoundException('Registration not found');
    }
    return reg;
  }

  async updateStatus(
    id: string,
    eventId: string,
    newStatus: FunnelStatus,
    _ownerId: string,
  ): Promise<RegistrationEntity> {
    const reg = await this.findById(id, eventId);
    if (reg.status === newStatus) return reg;
    if (!reg.canTransitionTo(newStatus)) {
      throw new BadRequestException(`Cannot transition from '${reg.status}' to '${newStatus}'`);
    }
    const previousStatus = reg.status;
    const updated = await this.regRepo.updateStatus(id, newStatus);

    const event = await this.eventsService.findById(reg.eventId);
    this.eventEmitter.emit(
      'registration.status_changed',
      new RegistrationStatusChanged(id, reg.eventId, previousStatus, newStatus, event.ownerId),
    );

    return updated;
  }

  async updateAnswers(
    id: string,
    eventId: string,
    answers: Record<string, unknown>,
    formFields: Array<{ label: string; type: string; required: boolean; isFixed: boolean }>,
  ): Promise<RegistrationEntity> {
    const reg = await this.regRepo.findById(id);
    if (!reg || reg.eventId !== eventId) {
      throw new NotFoundException('Registration not found');
    }

    for (const field of formFields) {
      if (field.required) {
        const val = answers[field.label];
        if (val === undefined || val === null || String(val).trim() === '') {
          throw new BadRequestException(`Campo obrigatório ausente: "${field.label}"`);
        }
      }
    }

    const mergedAnswers = { ...reg.answers, ...answers };

    const updateData: {
      answers: Record<string, unknown>;
      name?: string;
      email?: string;
      phone?: string;
    } = { answers: mergedAnswers };

    for (const f of formFields.filter((f) => f.isFixed)) {
      const raw = answers[f.label];
      const val = typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
      if (f.type === 'text' && val !== undefined) updateData.name = val;
      else if (f.type === 'email' && val !== undefined) updateData.email = val;
      else if (f.type === 'phone' && val !== undefined) updateData.phone = val;
    }

    return this.regRepo.updateAnswers(id, updateData);
  }

  async submitPostEvent(
    slug: string,
    identifier: string,
    answers: Record<string, unknown>,
    postEventFields: AnswerFieldMeta[],
  ): Promise<void> {
    await this.submitCrossForm(slug, 'post_event', identifier, answers, postEventFields);
  }

  async submitNps(
    slug: string,
    identifier: string,
    answers: Record<string, unknown>,
    npsFields: AnswerFieldMeta[],
  ): Promise<void> {
    await this.submitCrossForm(slug, 'nps', identifier, answers, npsFields);
  }

  /**
   * Shared flow for the post-event and NPS forms: validates fields, requires
   * the contact to match an existing registration, persists per-form storage
   * when applicable, consolidates into user_subscriptions, and fires the
   * matching automation trigger.
   */
  private async submitCrossForm(
    slug: string,
    kind: 'post_event' | 'nps',
    identifier: string,
    answers: Record<string, unknown>,
    fields: AnswerFieldMeta[],
  ): Promise<void> {
    const event = await this.eventsService.findBySlug(slug);
    if (event.status !== 'published' && event.status !== 'ended') {
      throw new BadRequestException('Event is not accepting form responses');
    }

    const id = identifier?.trim() ?? '';
    const contact = id.includes('@')
      ? { email: id.toLowerCase() }
      : { phone: id.replace(/\D/g, '') };

    if (!contact.email && !contact.phone) {
      throw new BadRequestException('Identificador (email ou telefone) é obrigatório');
    }

    validateAnswers(fields, answers);

    // A matching registration is required — post-event/NPS responses are only
    // meaningful for people who actually registered for the event.
    const reg = await this.regRepo.findByEventAndContact(event.id, contact);
    if (!reg) {
      throw new NotFoundException('Registration not found for this identifier');
    }

    if (kind === 'post_event') {
      await this.regRepo.upsertPostEventResponse({
        eventId: event.id,
        registrationId: reg.id,
        answers,
      });
    }

    const contactOverride = { name: reg.name, email: reg.email, phone: reg.phone };

    await this.userSubscriptions.upsertFromForm(event.id, kind, answers, contactOverride);

    this.eventEmitter.emit(
      'form.submitted',
      new FormSubmitted(event.id, kind === 'post_event' ? 'on_post_event' : 'on_nps', {
        name: contactOverride.name ?? '',
        email: contactOverride.email ?? '',
        phone: contactOverride.phone ?? '',
      }),
    );
  }

  private extractString(answers: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const val = answers[key];
      if (typeof val === 'string' && val.trim()) return val.trim();
    }
    return '';
  }
}
