import { Injectable } from '@nestjs/common';
import ical from 'ical-generator';

@Injectable()
export class IcsGeneratorService {
  generate(params: {
    title: string;
    start: Date;
    end?: Date;
    location?: string;
    description?: string;
  }): string {
    const cal = ical({ name: params.title });
    cal.createEvent({
      start: params.start,
      end: params.end ?? new Date(params.start.getTime() + 2 * 60 * 60 * 1000),
      summary: params.title,
      location: params.location,
      description: params.description,
    });
    return cal.toString();
  }
}
