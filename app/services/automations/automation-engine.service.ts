import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@database/prisma/prisma.service';
import { OutboxService } from '@services/messaging/outbox.service';
import { TemplateRenderer } from './template-renderer.service';
import { IcsGeneratorService } from './ics-generator.service';
import { RegistrationStatusChanged } from '@domain/registrations/entities/registration-status-changed.event';

const TRIGGER_MAP: Partial<Record<string, string>> = {
  pending: 'on_registration',
  screening: 'on_screening',
  qualification: 'on_qualification',
  approved: 'on_approval',
  rejected: 'on_rejection',
  waitlist: 'on_waitlist',
};

@Injectable()
export class AutomationEngine {
  private readonly logger = new Logger(AutomationEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly renderer: TemplateRenderer,
    private readonly ics: IcsGeneratorService,
  ) {}

  @OnEvent('registration.status_changed')
  async handleStatusChanged(ev: RegistrationStatusChanged): Promise<void> {
    const trigger = TRIGGER_MAP[ev.newStatus];
    if (!trigger) return;

    try {
      await this.fireAutomations(ev.registrationId, ev.eventId, trigger);
    } catch (err) {
      this.logger.error(
        { err, registrationId: ev.registrationId, trigger },
        'AutomationEngine error',
      );
    }
  }

  async fireAutomations(registrationId: string, eventId: string, trigger: string): Promise<void> {
    const rules = await this.prisma.automationRule.findMany({
      where: {
        eventId,

        trigger: trigger as any,
        active: true,
        delayMinutes: null, // non-scheduled rules only
      },
      include: { template: true },
    });

    if (!rules.length) return;

    const [registration, event] = await Promise.all([
      this.prisma.registration.findUnique({ where: { id: registrationId } }),
      this.prisma.event.findUnique({
        where: { id: eventId },
        include: { owner: true },
      }),
    ]);

    if (!registration || !event) {
      this.logger.warn(
        { registrationId, eventId },
        'Registration or event not found for automation',
      );
      return;
    }

    const instancia = event.evolutionInstance ?? event.owner.evolutionInstance ?? undefined;

    for (const rule of rules) {
      const vars = this.renderer.buildVariables({
        registration: {
          name: registration.name,
          email: registration.email,
          phone: registration.phone,
        },
        event: {
          title: event.title,
          eventDate: event.eventDate,
          location: event.location,
          capacity: event.capacity,
          dressCode: event.dressCode,
          groupLink: event.groupLink,
        },
      });

      const renderedBody = this.renderer.render(rule.template.body, vars);
      const renderedSubject = rule.template.subject
        ? this.renderer.render(rule.template.subject, vars)
        : undefined;

      let renderedBodyFinal = renderedBody;
      let icsContent: string | undefined;

      if (trigger === 'on_approval' && rule.template.channel === 'email' && event.eventDate) {
        icsContent = this.ics.generate({
          title: event.title,
          start: event.eventDate,
          location: event.location ?? undefined,
        });
        renderedBodyFinal = renderedBody;
      }

      await this.outbox.enqueue({
        eventId: event.id,
        registrationId,
        templateId: rule.templateId,
        trigger,
        channel: rule.template.channel,
        recipient: rule.template.channel === 'email' ? registration.email : registration.phone,
        instancia: instancia ?? undefined,
        renderedBody: renderedBodyFinal,
        renderedSubject,
      });

      // ICS generation confirmed but attachment handled by ResendAdapter in a future task
      void icsContent;
    }
  }
}
