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
import {
  validateAnswers,
  resolveAnswer,
  resolveAnswerByKeys,
  buildAnswerLookup,
  AnswerFieldMeta,
} from './answer-validation';
import { normalizePhone } from '@shared/phone';

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
    const email = this.extractByFieldType(answers, fields, 'email', ['email']);
    const phone = this.extractByFieldType(answers, fields, 'phone', ['telefone', 'phone']);
    const linkedin = this.extractByFieldType(answers, fields, 'linkedin', [
      'linkedin',
      'Linkedin',
      'LinkedIn',
    ]);
    const instagram = this.extractByFieldType(answers, fields, 'instagram', [
      'instagram',
      'Instagram',
    ]);

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
          contact: { email, phone, ...(linkedin && { linkedin }), ...(instagram && { instagram }) },
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

  /**
   * Bulk-imports registrations from an external list (e.g. spreadsheet).
   * Dedups against existing registrations by normalized phone/email and
   * skips duplicates. Does not emit `registration.status_changed` — an
   * imported batch shouldn't trigger `on_registration` automations for
   * every row.
   */
  async importMany(
    eventId: string,
    items: Array<{ nome: string; telefone?: string; email?: string }>,
  ): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    for (const item of items) {
      const name = item.nome.trim();
      const phone = item.telefone
        ? (normalizePhone(item.telefone) ?? item.telefone.replace(/\D/g, ''))
        : '';
      const email = item.email?.trim().toLowerCase() ?? '';

      if (!phone && !email) {
        skipped++;
        continue;
      }

      const existing = await this.regRepo.findByEventAndContact(eventId, {
        email: email || undefined,
        phone: phone || undefined,
      });
      if (existing) {
        skipped++;
        continue;
      }

      const answers: Record<string, unknown> = { nome: name };
      if (phone) answers.telefone = phone;
      if (email) answers.email = email;

      await this.regRepo.create({ eventId, answers, name, email, phone });
      created++;
    }

    return { created, skipped };
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
        const val = resolveAnswer(answers, field.label);
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

    const name = this.extractString(mergedAnswers, ['nome', 'name']);
    const email = this.extractByFieldType(mergedAnswers, formFields, 'email', ['email']);
    const phone = this.extractByFieldType(mergedAnswers, formFields, 'phone', ['telefone', 'phone']);

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;

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
      : { phone: normalizePhone(id) ?? id.replace(/\D/g, '') };

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
    const exact = resolveAnswerByKeys(answers, keys);
    if (typeof exact === 'string' && exact.trim()) return exact.trim();

    const lookup = buildAnswerLookup(answers);
    for (const key of keys) {
      const needle = key.trim().toLowerCase();
      for (const [k, val] of lookup) {
        if (k.includes(needle) && typeof val === 'string' && val.trim()) {
          return val.trim();
        }
      }
    }
    return '';
  }

  private extractByFieldType(
    answers: Record<string, unknown>,
    fields: AnswerFieldMeta[],
    type: string,
    fallbackKeys: string[] = [],
  ): string {
    const field = fields.find((f) => f.type === type);
    if (field) {
      const val = resolveAnswer(answers, field.label);
      if (typeof val === 'string' && val.trim()) return val.trim();
    }
    return this.extractString(answers, fallbackKeys);
  }
}
