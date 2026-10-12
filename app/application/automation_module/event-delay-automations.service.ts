import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AutomationRuleEntity } from '@domain/automation_module/automation-rule.entity';
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
 * Teto de atraso, o mesmo do `on_date` (`date-automations.service.ts`): depois
 * de uma queda longa, ou de um evento antecipado para um momento que já passou,
 * "seu evento é em 2h" não faz mais sentido. Passou do teto, a regra é marcada
 * como processada sem enviar.
 */
const MAX_LATENESS_MINUTES = 120;
const MAX_LATENESS_MS = MAX_LATENESS_MINUTES * 60_000;

/**
 * Varredura do gatilho `on_event_delay`: dispara uma vez, X tempo antes
 * (`eventDate`) ou depois (`endDate ?? eventDate`) do evento, para os inscritos
 * aprovados naquele momento.
 *
 * O modelo é dinâmico: a regra não guarda a data de disparo, só o delay. A cada
 * tick o momento (`fireAt`) é recalculado a partir da data ATUAL do evento, então
 * remarcar o evento move o disparo sem que o `EventService` precise saber que
 * automações existem.
 *
 * `firedForAt` é o `fireAt` que já foi processado. A regra dispara quando
 * `fireAt <= agora` e `fireAt != firedForAt`: evento remarcado ou delay editado
 * produz um `fireAt` novo e a regra rearma sozinha. Aprovado depois do disparo
 * não recebe — o público é o do momento do disparo.
 *
 * `occurrenceKey` é o ISO do `fireAt`, não a data do evento: o `dedupKey` do
 * outbox é `reg:template:trigger:occurrenceKey`, e com a data do evento "1 dia
 * antes" e "1 hora antes" com o mesmo template colidiriam no @unique.
 *
 * Como no `on_date`, a regra só é marcada **depois** do envio: se o processo
 * morrer no meio, o tick seguinte retenta e o `dedupKey` impede repetição.
 */
@Injectable()
export class EventDelayAutomationsService {
  private readonly logger = new Logger(EventDelayAutomationsService.name);
  private running = false;

  constructor(
    @Inject(AUTOMATION_REPOSITORY_PORT)
    private readonly automations: AutomationRepositoryPort,
    @Inject(EVENT_REPOSITORY_PORT) private readonly eventRepo: EventRepositoryPort,
    private readonly engine: AutomationEngine,
  ) {}

  @Cron('* * * * *')
  async sweep(): Promise<void> {
    // Tick de 1 min: sem a guarda, uma varredura lenta acumularia execuções
    // concorrentes sobre as mesmas regras.
    if (this.running) {
      this.logger.warn('sweep já em execução — tick ignorado');
      return;
    }
    this.running = true;
    try {
      await this.doSweep();
    } finally {
      this.running = false;
    }
  }

  private async doSweep(): Promise<void> {
    const candidates = await this.automations.findEventDelayCandidates();
    if (!candidates.length) return;

    let fired = 0;
    let stale = 0;

    for (const rule of candidates) {
      const fireAt = AutomationRuleEntity.computeEventDelayFireAt(rule.event, rule.delay);
      if (!fireAt || fireAt.getTime() > Date.now()) continue;
      if (rule.firedForAt?.getTime() === fireAt.getTime()) continue;

      const latenessMs = Date.now() - fireAt.getTime();
      if (latenessMs > MAX_LATENESS_MS) {
        this.logger.warn(
          {
            ruleId: rule.id,
            eventId: rule.eventId,
            fireAt: fireAt.toISOString(),
            latenessMinutes: Math.round(latenessMs / 60_000),
            maxLatenessMinutes: MAX_LATENESS_MINUTES,
          },
          'regra on_event_delay vencida além do teto de atraso — marcada como processada sem enviar',
        );
        await this.automations.markEventDelayRuleFired(rule.id, fireAt);
        stale += 1;
        continue;
      }

      const event = await this.eventRepo.findWithApprovedRegistrationIds(
        rule.eventId,
        rule.formIds,
      );
      if (!event) {
        this.logger.warn(
          { ruleId: rule.id, eventId: rule.eventId },
          'Event not found for event-delay automation',
        );
        await this.automations.markEventDelayRuleFired(rule.id, fireAt);
        continue;
      }

      for (const registrationId of event.registrationIds) {
        try {
          await this.engine.fireAutomations(
            registrationId,
            event.id,
            'on_event_delay',
            [rule.id],
            fireAt.toISOString(),
          );
        } catch (err) {
          this.logger.error(
            { err, registrationId, ruleId: rule.id },
            'Event-delay automation failed',
          );
        }
      }

      // Vale também quando o engine barrou tudo (evento em rascunho/cancelado):
      // o momento passou e não volta.
      await this.automations.markEventDelayRuleFired(rule.id, fireAt);
      fired += 1;
    }

    this.logger.log(
      `Event-delay automations fired: ${fired} rule(s), ${stale} stale rule(s) discarded`,
    );
  }
}
