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
 * Teto de atraso. A varredura é um backlog (`firedAt: null, sendAt <= now`), o
 * que a torna imune a queda curta — mas sem teto ela também dispara o que
 * venceu há dias. Depois de uma indisponibilidade longa isso vira "seu evento é
 * hoje" mandado para um evento que já aconteceu.
 *
 * Regra vencida além do teto é marcada como disparada sem enviar: a data passou
 * e não volta, então deixá-la pendurada só faria a varredura revisitá-la a cada
 * 5 min para sempre.
 */
const MAX_LATENESS_MINUTES = 120;
const MAX_LATENESS_MS = MAX_LATENESS_MINUTES * 60_000;

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

    let fired = 0;
    let stale = 0;

    for (const rule of due) {
      // Antes de tocar no banco do evento: regra vencida demais não gera
      // consulta nenhuma.
      const latenessMs = Date.now() - rule.sendAt.getTime();
      if (latenessMs > MAX_LATENESS_MS) {
        this.logger.warn(
          {
            ruleId: rule.id,
            eventId: rule.eventId,
            sendAt: rule.sendAt.toISOString(),
            latenessMinutes: Math.round(latenessMs / 60_000),
            maxLatenessMinutes: MAX_LATENESS_MINUTES,
          },
          'regra on_date vencida além do teto de atraso — marcada como disparada sem enviar',
        );
        await this.automations.markDateRuleFired(rule.id);
        stale += 1;
        continue;
      }

      const event = await this.eventRepo.findWithApprovedRegistrationIds(
        rule.eventId,
        rule.formIds,
      );
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
      fired += 1;
    }

    // `stale` separado de `fired`: sem isso uma queda longa aparece no log como
    // varredura bem-sucedida, escondendo quantas regras foram descartadas.
    this.logger.log(`Date automations fired: ${fired} rule(s), ${stale} stale rule(s) discarded`);
  }
}
