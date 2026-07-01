import { Injectable } from '@nestjs/common';
import ical, { ICalEventRepeatingFreq } from 'ical-generator';

export interface IcsRecurrence {
  freq: string;
  interval?: number;
  until?: Date;
}

export interface IcsGenerateParams {
  title: string;
  start: Date;
  end?: Date;
  allDay?: boolean;
  /** IANA timezone (ex: America/Sao_Paulo). Emite DTSTART/DTEND com TZID. */
  timezone?: string;
  location?: string;
  description?: string;
  /** UID estável — evita duplicação em reenvios do mesmo convite. */
  uid?: string;
  repeating?: IcsRecurrence;
}

@Injectable()
export class IcsGeneratorService {
  generate(params: IcsGenerateParams): string {
    const cal = ical({ name: params.title });
    const event = cal.createEvent({
      start: params.start,
      end: params.allDay
        ? undefined
        : (params.end ?? new Date(params.start.getTime() + 2 * 60 * 60 * 1000)),
      allDay: params.allDay ?? false,
      timezone: params.timezone,
      summary: params.title,
      location: params.location,
      description: params.description,
      id: params.uid,
    });

    if (params.repeating) {
      event.repeating({
        freq: params.repeating.freq.toUpperCase() as ICalEventRepeatingFreq,
        interval: params.repeating.interval ?? 1,
        until: params.repeating.until,
      });
    }

    return cal.toString();
  }
}
