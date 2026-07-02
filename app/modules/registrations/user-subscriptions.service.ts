import { Injectable, Inject } from '@nestjs/common';
import {
  USER_SUBSCRIPTION_REPOSITORY_PORT,
  UserSubscriptionRepositoryPort,
  UserSubscriptionRow,
  FormKind,
  PipedriveStatus,
} from '@modules/registrations/ports/user-subscription-repository.port';

@Injectable()
export class UserSubscriptionsService {
  constructor(
    @Inject(USER_SUBSCRIPTION_REPOSITORY_PORT)
    private readonly repo: UserSubscriptionRepositoryPort,
  ) {}

  /**
   * Consolidates a form submission into the per-event/per-person row,
   * cross-matching by email or phone. Best-effort: if it can't be matched
   * to an existing subscription, a new one is created.
   */
  async upsertFromForm(
    eventId: string,
    kind: FormKind,
    answers: Record<string, unknown>,
    contactOverride?: { name?: string; email?: string; phone?: string },
  ): Promise<UserSubscriptionRow> {
    // Explicit contact (e.g. post-event/NPS identifier) wins; otherwise the
    // contact is extracted from the answers (e.g. main registration form).
    const name = contactOverride?.name || this.extractString(answers, ['nome', 'name']);
    const email = contactOverride?.email || this.extractString(answers, ['email']);
    const phone = contactOverride?.phone || this.extractString(answers, ['telefone', 'phone']);

    const contact = {
      name: name || undefined,
      email: email || undefined,
      phone: phone || undefined,
    };

    const existing =
      email || phone
        ? await this.repo.findByEventAndContact(eventId, {
            email: email || undefined,
            phone: phone || undefined,
          })
        : null;

    if (existing) {
      return this.repo.update(existing.id, { contact, kind, answers });
    }
    return this.repo.create({ eventId, contact, kind, answers });
  }

  async findAllPaginated(
    eventId: string,
    page: number,
    limit: number,
    search?: string,
  ): Promise<{ data: UserSubscriptionRow[]; total: number }> {
    return this.repo.findAllByEventPaginated(
      eventId,
      { skip: (page - 1) * limit, take: limit },
      search,
    );
  }

  async findAllByEvent(eventId: string, search?: string): Promise<UserSubscriptionRow[]> {
    return this.repo.findAllByEvent(eventId, search);
  }

  async markPipedrive(
    id: string,
    sendToPipedrive: boolean,
    pipedriveStatus: PipedriveStatus,
  ): Promise<void> {
    await this.repo.setPipedrive(id, { sendToPipedrive, pipedriveStatus });
  }

  private extractString(answers: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const val = answers[key];
      if (typeof val === 'string' && val.trim()) return val.trim();
    }
    return '';
  }
}
