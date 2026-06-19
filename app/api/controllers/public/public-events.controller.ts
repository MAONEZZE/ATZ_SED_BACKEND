import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PrismaService } from '@database/prisma/prisma.service';

@ApiTags('Public')
@Controller('public/events')
export class PublicEventsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Buscar evento público por slug' })
  @ApiParam({ name: 'slug', description: 'Slug do evento' })
  @ApiResponse({ status: 200, description: 'Evento publicado' })
  @ApiResponse({ status: 404, description: 'Evento não encontrado ou não publicado' })
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
        endDate: true,
        postRegistrationMessage: true,
        status: true,
      },
    });

    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== 'published' && event.status !== 'ended') {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  @Get(':slug/form-fields')
  @ApiOperation({ summary: 'Buscar campos do formulário de inscrição (público)' })
  @ApiParam({ name: 'slug', description: 'Slug do evento' })
  @ApiResponse({ status: 200, description: 'Campos do formulário' })
  @ApiResponse({ status: 404, description: 'Evento não encontrado ou não publicado' })
  async getFormFields(@Param('slug') slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });

    if (!event || event.status !== 'published') {
      throw new NotFoundException('Event not found');
    }

    return this.prisma.formField.findMany({
      where: { eventId: event.id, kind: 'registration' },
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

  @Get(':slug/post-event-fields')
  @ApiOperation({ summary: 'Buscar campos do formulário pós-evento (público)' })
  @ApiParam({ name: 'slug', description: 'Slug do evento' })
  @ApiResponse({ status: 200, description: 'Campos do formulário pós-evento' })
  @ApiResponse({ status: 404, description: 'Evento não encontrado' })
  async getPostEventFields(@Param('slug') slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });

    if (!event || (event.status !== 'published' && event.status !== 'ended')) {
      throw new NotFoundException('Event not found');
    }

    return this.prisma.formField.findMany({
      where: { eventId: event.id, kind: 'post_event' },
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
