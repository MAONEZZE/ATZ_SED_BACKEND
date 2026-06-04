import {
  Controller,
  Get,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@database/prisma/prisma.service';

@Controller('public/events')
export class PublicEventsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':slug')
  async getPublicEvent(@Param('slug') slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        coverUrl: true,
        location: true,
        capacity: true,
        dressCode: true,
        eventDate: true,
        status: true,
        landingPage: {
          include: {
            sections: {
              where: { enabled: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== 'published') throw new NotFoundException('Event not found');

    return event;
  }

  @Get(':slug/form-fields')
  async getFormFields(@Param('slug') slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });

    if (!event || event.status !== 'published') {
      throw new NotFoundException('Event not found');
    }

    return this.prisma.formField.findMany({
      where: { eventId: event.id },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        label: true,
        type: true,
        required: true,
        options: true,
        order: true,
      },
    });
  }
}
