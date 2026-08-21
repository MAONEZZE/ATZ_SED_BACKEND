import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DateTime } from 'luxon';
import {
  AUTOMATION_REPOSITORY_PORT,
  AutomationRepositoryPort,
  FormFieldDateRule,
} from '@domain/automation_module/i-repository-automation';
import {
  FORM_FIELD_REPOSITORY_PORT,
  FormFieldRepositoryPort,
} from '@domain/form_field_module/i-repository-form-field';
import {
  FORM_RESPONSE_REPOSITORY_PORT,
  FormResponseRepositoryPort,
} from '@domain/form_response_module/i-repository-form-response';
import { DEFAULT_SEND_TIME } from '@domain/automation_module/automation-rule.entity';
import { APP_TIMEZONE } from '@handlers/timezone';
import { AutomationEngine } from '@application/automation_module/automation-engine.service';

const SWEEP_CRON = '2-59/5 * * * *'; // deslocado do sweeper do on_date (*/5)
const TOLERANCE_MINUTES = 30; // 6 ticks: sobrevive a ~25min de indisponibilidade
const RULES_PER_TICK = 200;
const RESPONSES_PER_PAGE = 500;
// Estimativa pra log: média do gap anti-ban (WA_AUTOMATION_GAP_MIN/MAX_MS,
// default 40-60s) — não lê o env real de propósito, é só ordem de grandeza
// pra decidir quando logar o alerta de horizonte de envio.
const ESTIMATED_PACE_GAP_MS = 50_000;

interface RuleWindow {
  rule: FormFieldDateRule;
  anchor: DateTime;
  occurrenceKey: string;
}

/**
 * Varredura mensal do gatilho `on_date_form_field`: cada inscrito `approved`
 * recebe uma mensagem no dia-do-mês que ele mesmo respondeu num campo
 * `on_date_automation_field`, na hora da regra (`sendTime`, no `timezone`
 * dela).
 *
 * Diferente de `on_date` (disparo único, mesmo instante pra todos) e de
 * `recurring` (cron por regra, sem relação com o formulário). Não existe
 * tabela de agenda materializada — a recorrência é calculável a cada tick.
 *
 * Idempotência e réplicas: o `dedupKey` do outbox (`AutomationEngine`,
 * `${registrationId}:${templateId}:on_date_form_field:${occurrenceKey}`) é
 * @unique, e cobre outbox, cursor de pacing, `queue.add` (jobId derivado) e o
 * envio (worker pula `sent`). N réplicas rodando o mesmo tick só pagam o custo
 * de leituras repetidas — nenhuma mensagem sai duas vezes. Por isso não há
 * lock: advisory lock não serve nesta stack (`DATABASE_URL` tem
 * `pgbouncer=true` — lock de sessão num pool em modo transaction fica órfão na
 * conexão física e o sweeper morre pra sempre).
 */
@Injectable()
export class FormFieldDateAutomationsService {
  private readonly logger = new Logger(FormFieldDateAutomationsService.name);
  private running = false;

  constructor(
    @Inject(AUTOMATION_REPOSITORY_PORT)
    private readonly automations: AutomationRepositoryPort,
    @Inject(FORM_FIELD_REPOSITORY_PORT)
    private readonly formFields: FormFieldRepositoryPort,
    @Inject(FORM_RESPONSE_REPOSITORY_PORT)
    private readonly formResponses: FormResponseRepositoryPort,
    private readonly engine: AutomationEngine,
  ) {}

  @Cron(SWEEP_CRON)
  async sweep(): Promise<void> {
    // @nestjs/schedule não impede sobreposição: lote de vários minutos com
    // cron de 5 em 5 faria dois sweeps concorrentes se pisarem, cada um mais
    // lento — colapso do pool.
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
    // Uma vez só, no topo: recalcular por regra faria a última regra da lista
    // (query estável) perder a janela se as primeiras gastarem tempo — mês
    // perdido só pras últimas, todo mês.
    const now = DateTime.now();

    const rules = await this.automations.findActiveFormFieldDateRules({ take: RULES_PER_TICK });
    if (rules.length === 0) return;

    // Pré-filtro de janela antes de tocar em campo/respostas — é o que segura
    // o custo: fora da janela, o tick custa 1 SELECT numa tabela pequena.
    const windows: RuleWindow[] = [];
    for (const rule of rules) {
      const zone = rule.timezone?.trim() || APP_TIMEZONE;
      const sendTime = rule.sendTime?.trim() || DEFAULT_SEND_TIME;
      const resolved = resolveWindow(now, zone, sendTime);
      if (!resolved) {
        if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(sendTime)) {
          this.logger.error(
            { ruleId: rule.id, eventId: rule.eventId, sendTime },
            'regra on_date_form_field com sendTime inválido — permanentemente fora da janela',
          );
        }
        continue;
      }
      windows.push({ rule, anchor: resolved.anchor, occurrenceKey: resolved.occurrenceKey });
    }
    if (windows.length === 0) return;

    // Agrupar por evento (normalmente 1 regra por evento) pra não repetir
    // campo+respostas quando duas regras do mesmo evento estão na janela.
    const byEvent = new Map<string, RuleWindow[]>();
    for (const w of windows) {
      const list = byEvent.get(w.rule.eventId) ?? [];
      list.push(w);
      byEvent.set(w.rule.eventId, list);
    }

    for (const [eventId, ruleWindows] of byEvent) {
      try {
        await this.sweepEvent(eventId, ruleWindows);
      } catch (err) {
        this.logger.error(
          { err, eventId, ruleIds: ruleWindows.map((w) => w.rule.id) },
          'sweep on_date_form_field falhou pro evento',
        );
      }
    }
  }

  private async sweepEvent(eventId: string, ruleWindows: RuleWindow[]): Promise<void> {
    const field = await this.formFields.findByEventAndType(eventId, 'on_date_automation_field');
    if (!field) {
      this.logger.warn(
        { eventId, ruleIds: ruleWindows.map((w) => w.rule.id) },
        'regra on_date_form_field sem campo no evento',
      );
      return;
    }

    const stats = new Map(
      ruleWindows.map((w) => [
        w.rule.id,
        { candidates: 0, enqueued: 0, unparseable: 0, empty: 0 },
      ]),
    );

    let skip = 0;
    for (;;) {
      let page: Array<{ registrationId: string; answers: Record<string, unknown> }>;
      try {
        page = await this.formResponses.findApprovedByForm(field.formId, {
          skip,
          take: RESPONSES_PER_PAGE,
        });
      } catch (err) {
        this.logger.error({ err, eventId, formId: field.formId, skip }, 'falha lendo página de respostas');
        break;
      }
      if (page.length === 0) break;

      for (const response of page) {
        const rawValue = response.answers[field.id];
        const day = parseDay(rawValue);

        for (const w of ruleWindows) {
          const s = stats.get(w.rule.id)!;
          s.candidates += 1;

          if (rawValue === undefined || rawValue === null || rawValue === '') {
            s.empty += 1;
            continue;
          }
          if (day === null) {
            s.unparseable += 1;
            continue;
          }
          if (!clampMatches(day, w.anchor)) continue;

          try {
            await this.engine.fireAutomations(
              response.registrationId,
              eventId,
              'on_date_form_field',
              [w.rule.id],
              w.occurrenceKey,
              { dia_automacao: String(day) },
            );
            s.enqueued += 1;
          } catch (err) {
            this.logger.error(
              { err, eventId, ruleId: w.rule.id, registrationId: response.registrationId },
              'falha disparando on_date_form_field pro inscrito',
            );
          }
        }
      }

      if (page.length < RESPONSES_PER_PAGE) break;
      skip += RESPONSES_PER_PAGE;
    }

    // Log estruturado por regra: sem tabela de agenda, sem firedAt, sem
    // contador — é a única visibilidade de que o mês não foi perdido.
    for (const w of ruleWindows) {
      const s = stats.get(w.rule.id)!;
      const estimatedLastSendAt = new Date(Date.now() + s.enqueued * ESTIMATED_PACE_GAP_MS);
      this.logger.log({
        ruleId: w.rule.id,
        eventId,
        occurrenceKey: w.occurrenceKey,
        targetDay: w.anchor.day,
        timezone: w.anchor.zoneName,
        sendTime: w.rule.sendTime ?? DEFAULT_SEND_TIME,
        candidates: s.candidates,
        enqueued: s.enqueued,
        unparseable: s.unparseable,
        empty: s.empty,
        estimatedLastSendAt: estimatedLastSendAt.toISOString(),
      });
      if (s.enqueued > 0 && estimatedLastSendAt.getTime() - Date.now() > 4 * 60 * 60 * 1000) {
        this.logger.warn(
          { ruleId: w.rule.id, eventId, estimatedLastSendAt: estimatedLastSendAt.toISOString() },
          'horizonte de envio do lote passa de 4h — pacing anti-ban vira janela de horas',
        );
      }
    }
  }
}

/**
 * Janela do tick, e a chave da ocorrência — os dois saem do mesmo âncora
 * (hoje ou ontem), nunca de `now` puro. Dois bugs no mesmo lugar se saírem de
 * `now`: duplicata na virada do mês (`occurrenceKey` diferente pro mesmo
 * disparo) e mês perdido no caminho inverso (dia comparado errado pós-meia-
 * noite). `off: 0` e `off: -1` nunca casam juntos (âncoras a 24h).
 */
export function resolveWindow(
  now: DateTime,
  zone: string,
  sendTime: string,
): { anchor: DateTime; occurrenceKey: string } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(sendTime);
  if (!m) return null;
  const nowZ = now.setZone(zone);
  for (const off of [0, -1]) {
    const anchor = nowZ
      .plus({ days: off })
      .startOf('day')
      .set({ hour: +m[1], minute: +m[2] });
    if (nowZ >= anchor && nowZ < anchor.plus({ minutes: TOLERANCE_MINUTES })) {
      return { anchor, occurrenceKey: anchor.toFormat('yyyy-MM') };
    }
  }
  return null;
}

/**
 * Clamp a partir do âncora, nunca de `now`. `>` e não `>=`: dia 31 num mês de
 * 31 não dispara no dia 30. Luxon resolve bissexto sozinho. Consequência
 * operacional: em 28/fev disparam os dias 28+29+30+31 no mesmo tick (4× o
 * lote); em 30/abr, 30/jun, 30/set, 30/nov disparam 30+31.
 */
export function clampMatches(answerDay: number, anchor: DateTime): boolean {
  return (
    answerDay === anchor.day || (anchor.day === anchor.daysInMonth && answerDay > anchor.daysInMonth)
  );
}

/**
 * Nunca MM/DD/YYYY — ambíguo, e o público é BR. `null` → conta em
 * `unparseable`, nunca lança.
 */
export function parseDay(val: unknown): number | null {
  if (typeof val !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
    const dt = DateTime.fromISO(val.slice(0, 10));
    return dt.isValid ? dt.day : null;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
    const dt = DateTime.fromFormat(val, 'dd/MM/yyyy');
    return dt.isValid ? dt.day : null;
  }
  return null;
}
