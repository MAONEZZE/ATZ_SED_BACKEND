import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  REGISTRATION_REPOSITORY_PORT,
  RegistrationRepositoryPort,
} from '@domain/registration_module/i-repository-registration';
import { RegistrationEntity, FunnelStatus } from '@domain/registration_module/registration.entity';
import { RegistrationStatusChanged } from '@domain/registration_module/registration-status-changed.event';
import { FormSubmitted } from '@domain/registration_module/form-submitted.event';
import { EventService } from '@application/event_module/event.service';
import { EventEntity } from '@domain/event_module/event.entity';
import { CRM_PORT, CrmPort } from '@domain/shared/i-crm';
import { FormService } from '@application/form_module/form.service';
import {
  FORM_RESPONSE_REPOSITORY_PORT,
  FormResponseRepositoryPort,
} from '@domain/form_response_module/i-repository-form-response';
import {
  FORM_FIELD_REPOSITORY_PORT,
  FormFieldRepositoryPort,
} from '@domain/form_field_module/i-repository-form-field';
import {
  validateAnswers,
  resolveAnswer,
  resolveAnswerByKeys,
  buildAnswerLookup,
  AnswerFieldMeta,
} from '@domain/shared/answer-validation';
import { normalizePhone } from '@handlers/phone';

/** Teto de ids por requisição em lote (delete e presença). */
const MAX_BATCH = 500;

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    @Inject(REGISTRATION_REPOSITORY_PORT)
    private readonly regRepo: RegistrationRepositoryPort,
    private readonly eventsService: EventService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(CRM_PORT) private readonly pipedrive: CrmPort,
    private readonly formsService: FormService,
    @Inject(FORM_RESPONSE_REPOSITORY_PORT)
    private readonly formResponses: FormResponseRepositoryPort,
    @Inject(FORM_FIELD_REPOSITORY_PORT)
    private readonly formFields: FormFieldRepositoryPort,
  ) {}

  /**
   * Submissão pública de **qualquer** formulário do evento (os 3 tipos fixos
   * morreram em 2026-08-17). O telefone é a identidade: normalizado, ele casa
   * com um inscrito do evento; sem match, o inscrito é criado ali mesmo.
   *
   * A resposta sempre vai para `FormResponse` (uma por form + inscrito, reenviar
   * sobrescreve); `Registration.answers` guarda o que veio no primeiro contato.
   */
  /** Evento público por slug — a listagem pública de formulários precisa do id. */
  publicEventBySlug(slug: string) {
    return this.eventsService.findBySlug(slug);
  }

  async submitForm(
    eventSlug: string,
    formSlug: string,
    phone: string,
    answers: Record<string, unknown>,
    options?: { sendToPipedrive?: boolean; imageAuthorization?: boolean },
  ): Promise<{ registration: RegistrationEntity; created: boolean }> {
    const event = await this.eventsService.findBySlug(eventSlug);
    if (event.status !== 'published' && event.status !== 'ended') {
      throw new BadRequestException('Event is not accepting form responses');
    }
    const form = await this.formsService.findPublic(eventSlug, formSlug);

    const fields = await this.formFields.listValidationFields(form.id);
    validateAnswers(fields, answers);

    const normalized = normalizePhone(phone) ?? phone.replace(/\D/g, '');
    if (!normalized) throw new BadRequestException('Telefone é obrigatório');

    const existing = await this.regRepo.findByEventAndContact(event.id, { phone: normalized });
    const registration = existing
      ? existing
      : await this.createFromForm(event, form, normalized, answers, options?.imageAuthorization);

    await this.formResponses.upsert({
      formId: form.id,
      eventId: event.id,
      registrationId: registration.id,
      answers,
    });

    this.eventEmitter.emit(
      'form.submitted',
      new FormSubmitted(event.id, form.id, {
        name: registration.name,
        email: registration.email,
        phone: registration.phone,
      }),
    );

    if (!existing) {
      await this.sendToPipedrive(event, registration, answers, options?.sendToPipedrive);
    }

    return { registration, created: !existing };
  }

  /** Inscrito novo a partir de um formulário: aplica capacidade e o funil. */
  private async createFromForm(
    event: EventEntity,
    form: { id: string; requireImageAuthorization: boolean },
    phone: string,
    answers: Record<string, unknown>,
    imageAuthorization?: boolean,
  ): Promise<RegistrationEntity> {
    if (event.status !== 'published') {
      throw new BadRequestException('Event is not accepting new registrations');
    }
    if (event.capacity != null) {
      const currentCount = await this.regRepo.countByEvent(event.id);
      if (currentCount >= event.capacity) {
        throw new BadRequestException('Event has reached its registration capacity');
      }
    }
    if (form.requireImageAuthorization && imageAuthorization !== true) {
      throw new BadRequestException('Autorização de uso de imagem é obrigatória');
    }

    const fields = await this.formFields.listValidationFields(form.id);
    const reg = await this.regRepo.create({
      eventId: event.id,
      answers,
      name: this.extractString(answers, ['nome', 'name']),
      email: this.extractByFieldType(answers, fields, 'email', ['email']),
      phone,
      imageAuthorization: imageAuthorization === true,
    });

    this.eventEmitter.emit(
      'registration.status_changed',
      new RegistrationStatusChanged(reg.id, event.id, 'pending', 'pending', event.ownerId, form.id),
    );
    return reg;
  }

  /**
   * Fire-and-forget: não bloqueia a resposta pública no webhook. O resultado
   * fica em `Registration.pipedriveStatus` (antes vivia em user_subscriptions).
   */
  private async sendToPipedrive(
    event: EventEntity,
    reg: RegistrationEntity,
    answers: Record<string, unknown>,
    override?: boolean,
  ): Promise<void> {
    const should = override ?? event.sendToPipedrive;
    if (!should) {
      await this.regRepo.setPipedriveStatus(reg.id, 'skipped');
      return;
    }
    await this.regRepo.setPipedriveStatus(reg.id, 'pending');
    void this.pipedrive
      .send({
        event: { id: event.id, slug: event.slug, title: event.title },
        form: 'registration',
        contact: { email: reg.email, phone: reg.phone },
        answers,
      })
      .then(() => this.regRepo.setPipedriveStatus(reg.id, 'sent'))
      .catch((err) => {
        this.logger.error({ err, eventId: event.id }, 'Pipedrive webhook error');
        return this.regRepo.setPipedriveStatus(reg.id, 'failed');
      });
  }

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

      await this.regRepo.create({
        eventId,
        answers,
        name,
        email,
        phone,
        imageAuthorization: false,
      });
      created++;
    }

    return { created, skipped };
  }

  async findAll(
    eventId: string,
    status?: FunnelStatus,
    search?: string,
    attended?: boolean,
  ): Promise<RegistrationEntity[]> {
    return this.regRepo.findAllByEvent(eventId, status, search, attended);
  }

  async findAllPaginated(
    eventId: string,
    page: number,
    limit: number,
    status?: FunnelStatus,
    search?: string,
    attended?: boolean,
  ): Promise<{ data: RegistrationEntity[]; total: number }> {
    return this.regRepo.findAllByEventPaginated(
      eventId,
      { skip: (page - 1) * limit, take: limit },
      status,
      search,
      attended,
    );
  }

  /**
   * Delete definitivo: leva junto as mensagens (outbox + logs) e a resposta de
   * pós-evento do inscrito, por cascata do banco.
   */
  async delete(id: string, eventId: string): Promise<void> {
    await this.findById(id, eventId);
    await this.regRepo.deleteMany([id], eventId);
  }

  /** Só ids explícitos: o front manda exatamente quem foi selecionado na tela. */
  async deleteMany(ids: string[], eventId: string): Promise<number> {
    this.assertBatch(ids);
    return this.regRepo.deleteMany(ids, eventId);
  }

  async setAttendance(ids: string[], eventId: string, attended: boolean): Promise<number> {
    this.assertBatch(ids);
    return this.regRepo.setAttendance(ids, eventId, attended);
  }

  /**
   * Check-in público: QR único do evento → a pessoa informa o telefone. Casa
   * com o inscrito pelo telefone normalizado; quem não está inscrito não entra
   * na lista por aqui (404).
   */
  async checkIn(slug: string, phone: string): Promise<RegistrationEntity> {
    const event = await this.eventsService.findBySlug(slug);
    if (event.status !== 'published' && event.status !== 'ended') {
      throw new BadRequestException('Event is not accepting check-ins');
    }
    const normalized = normalizePhone(phone) ?? phone.replace(/\D/g, '');
    if (!normalized) throw new BadRequestException('Telefone é obrigatório');

    const reg = await this.regRepo.findByEventAndContact(event.id, { phone: normalized });
    if (!reg) throw new NotFoundException('Registration not found for this phone');

    await this.regRepo.setAttendance([reg.id], event.id, true);
    return this.findById(reg.id, event.id);
  }

  private assertBatch(ids: string[]): void {
    if (ids.length === 0) throw new BadRequestException('Informe ao menos um id');
    if (ids.length > MAX_BATCH) {
      throw new BadRequestException(`Máximo de ${MAX_BATCH} inscrições por requisição`);
    }
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
    const phone = this.extractByFieldType(mergedAnswers, formFields, 'phone', [
      'telefone',
      'phone',
    ]);

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;

    return this.regRepo.updateAnswers(id, updateData);
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
