import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  AUTOMATION_REPOSITORY_PORT,
  AutomationRepositoryPort,
} from '@domain/automation_module/i-repository-automation';
import {
  EVENT_REPOSITORY_PORT,
  EventRepositoryPort,
} from '@domain/event_module/i-repository-event';
import { AutomationEngine } from '@application/automation_module/automation-engine.service';

/**
 * Varredura do gatilho `on_date`: disparo único, na data marcada na regra, para
 * os inscritos aprovados naquele momento.
 *
 * O agendamento mora no Postgres, não no Redis — um job BullMQ `delayed` de
 * meses seria perdido num flush. O claim (`fired_at`) é feito pelo repositório
 * no mesmo UPDATE que lê as regras vencidas, então duas réplicas do backend não
 * disparam a mesma regra.
 */
@Injectable()
export class DateAutomationsService {
  private readonly logger = new Logger(DateAutomationsService.name);

  constructor(
    @Inject(AUTOMATION_REPOSITORY_PORT)
    private readonly automations: AutomationRepositoryPort,
    @Inject(EVENT_REPOSITORY_PORT) private readonly eventRepo: EventRepositoryPort,
    private readonly engine: AutomationEngine,
  ) {}

  @Cron('*/5 * * * *')
  async sweep(): Promise<void> {
    const due = await this.automations.claimDueDateRules();
    if (!due.length) return;

    for (const rule of due) {
      const event = await this.eventRepo.findWithApprovedRegistrationIds(rule.eventId);
      if (!event) {
        this.logger.warn(
          { ruleId: rule.id, eventId: rule.eventId },
          'Event not found for date automation',
        );
        continue;
      }

      for (const registrationId of event.registrationIds) {
        try {
          // A data entra no dedupKey do outbox: reprocessar a mesma regra não
          // manda a mensagem duas vezes.
          await this.engine.fireAutomations(
            registrationId,
            event.id,
            'on_date',
            [rule.id],
            rule.sendAt.toISOString(),
          );
        } catch (err) {
          this.logger.error({ err, registrationId, ruleId: rule.id }, 'Date automation failed');
        }
      }
    }

    this.logger.log(`Date automations fired: ${due.length} rule(s)`);
  }
}
