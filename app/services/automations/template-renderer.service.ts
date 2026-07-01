import { Injectable } from '@nestjs/common';
import { APP_TIMEZONE } from '@domain/shared/constants/timezone';

@Injectable()
export class TemplateRenderer {
  render(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{\s*([\w_]+)\s*\}\}/gi, (_match, key: string) => {
      return variables[key.toLowerCase()] ?? '';
    });
  }

  buildVariables(params: {
    registration: {
      name: string;
      email: string;
      phone: string;
    };
    event?: {
      title?: string;
      eventDate?: Date | null;
      location?: string | null;
      capacity?: number | null;
      dressCode?: string | null;
      groupLink?: string | null;
    };
    extra?: Record<string, string>;
  }): Record<string, string> {
    const { registration, event = {}, extra = {} } = params;
    return {
      nome: registration.name,
      name: registration.name,
      email: registration.email,
      telefone: registration.phone,
      phone: registration.phone,
      evento: event.title ?? '',
      event: event.title ?? '',
      data: event.eventDate
        ? event.eventDate.toLocaleDateString('pt-BR', {
            timeZone: APP_TIMEZONE,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '',
      local: event.location ?? '',
      capacidade: event.capacity?.toString() ?? '',
      dress_code: event.dressCode ?? '',
      link_grupo: event.groupLink ?? '',
      invite: '[[[ICS_INVITE]]]',
      invite_recorrente: '[[[ICS_INVITE_RECURRENT]]]',
      ...extra,
    };
  }
}
