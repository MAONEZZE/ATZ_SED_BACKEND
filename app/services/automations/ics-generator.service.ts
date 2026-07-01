import { Injectable } from '@nestjs/common';
import ical, { ICalEventRepeatingFreq } from 'ical-generator';

export interface IcsRecurrence {
  freq: string;
  interval?: number;
  until?: Date;
}

@Injectable()
export class IcsGeneratorService {
  generate(params: {
    title: string;
    start: Date;
    end?: Date;
    location?: string;
    description?: string;
    repeating?: IcsRecurrence;
  }): string {
    const cal = ical({ name: params.title });
    const event = cal.createEvent({
      start: params.start,
      end: params.end ?? new Date(params.start.getTime() + 2 * 60 * 60 * 1000),
      summary: params.title,
      location: params.location,
      description: params.description,
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
