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
 * meses seria perdido num flush.
 *
 * A regra só é marcada como disparada **depois** do envio: se o processo morrer
 * no meio da varredura, ela continua vencida e o tick seguinte retenta. Isso é
 * seguro porque o caminho é idempotente — o `dedupKey` do outbox é @unique
 * (`OutboxRepository.enqueue` devolve a linha existente no P2002) e o
 * `MessageDispatchWorker` ignora linha já `sent`. O preço é que duas réplicas
 * podem repetir o trabalho da mesma regra; nenhuma mensagem sai duas vezes.
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
    const due = await this.automations.findDueDateRules();
    if (!due.length) return;

    for (const rule of due) {
      const event = await this.eventRepo.findWithApprovedRegistrationIds(rule.eventId);
      if (!event) {
        // Evento apagado leva a regra em cascata, então isto é quase impossível;
        // marcar evita revarrer a mesma linha a cada 5 min se acontecer.
        this.logger.warn(
          { ruleId: rule.id, eventId: rule.eventId },
          'Event not found for date automation',
        );
        await this.automations.markDateRuleFired(rule.id);
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

      // Depois do loop: a data passou, a regra não volta. Vale também quando o
      // engine barrou tudo (evento em rascunho ou cancelado) — a data não fica
      // pendurada esperando uma publicação futura.
      await this.automations.markDateRuleFired(rule.id);
    }

    this.logger.log(`Date automations fired: ${due.length} rule(s)`);
  }
}
