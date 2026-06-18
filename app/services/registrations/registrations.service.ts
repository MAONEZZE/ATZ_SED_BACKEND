import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  REGISTRATION_REPOSITORY_PORT,
  RegistrationRepositoryPort,
} from '@domain/registrations/ports/registration-repository.port';
import {
  RegistrationEntity,
  FunnelStatus,
} from '@domain/registrations/entities/registration.entity';
import { RegistrationStatusChanged } from '@domain/registrations/entities/registration-status-changed.event';
import { EventsService } from '@services/events/events.service';

@Injectable()
export class RegistrationsService {
  constructor(
    @Inject(REGISTRATION_REPOSITORY_PORT)
    private readonly regRepo: RegistrationRepositoryPort,
    private readonly eventsService: EventsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createPublic(slug: string, answers: Record<string, unknown>): Promise<RegistrationEntity> {
    const event = await this.eventsService.findBySlug(slug);
    if (event.status !== 'published') {
      throw new BadRequestException('Event is not accepting registrations');
    }

    const name = this.extractString(answers, ['nome', 'name']);
    const email = this.extractString(answers, ['email']);
    const phone = this.extractString(answers, ['telefone', 'phone']);

    const reg = await this.regRepo.create({ eventId: event.id, answers, name, email, phone });

    this.eventEmitter.emit(
      'registration.status_changed',
      new RegistrationStatusChanged(reg.id, event.id, 'pending', 'pending', event.ownerId),
    );

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

  async findById(id: string): Promise<RegistrationEntity> {
    const reg = await this.regRepo.findById(id);
    if (!reg) throw new NotFoundException('Registration not found');
    return reg;
  }

  async updateStatus(
    id: string,
    newStatus: FunnelStatus,
    _ownerId: string,
  ): Promise<RegistrationEntity> {
    const reg = await this.findById(id);
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

    const updateData: {
      answers: Record<string, unknown>;
      name?: string;
      email?: string;
      phone?: string;
    } = { answers };

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
    postEventFields: Array<{ label: string; required: boolean }>,
  ): Promise<void> {
    const event = await this.eventsService.findBySlug(slug);
    if (event.status !== 'published' && event.status !== 'ended') {
      throw new BadRequestException('Event is not accepting post-event responses');
    }

    const id = identifier?.trim() ?? '';
    const contact = id.includes('@')
      ? { email: id.toLowerCase() }
      : { phone: id.replace(/\D/g, '') };

    if (!contact.email && !contact.phone) {
      throw new NotFoundException('Inscrição não encontrada');
    }

    const reg = await this.regRepo.findByEventAndContact(event.id, contact);
    if (!reg) throw new NotFoundException('Inscrição não encontrada');

    for (const field of postEventFields) {
      if (field.required) {
        const val = answers[field.label];
        if (val === undefined || val === null || String(val).trim() === '') {
          throw new BadRequestException(`Campo obrigatório ausente: "${field.label}"`);
        }
      }
    }

    await this.regRepo.upsertPostEventResponse({
      eventId: event.id,
      registrationId: reg.id,
      answers,
    });
  }

  private extractString(answers: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const val = answers[key];
      if (typeof val === 'string' && val.trim()) return val.trim();
    }
    return '';
  }
}
