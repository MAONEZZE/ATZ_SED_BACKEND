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

    if (!name || !email || !phone) {
      throw new BadRequestException(
        'Required fields missing: nome (name), email, telefone (phone)',
      );
    }

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

  private extractString(answers: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const val = answers[key];
      if (typeof val === 'string' && val.trim()) return val.trim();
    }
    return '';
  }
}
