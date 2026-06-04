import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, HttpCode,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { PrismaService } from '@database/prisma/prisma.service';
import { CreateTemplateDto, UpdateTemplateDto } from '../templates_dto/template.dto';

@Controller('events/:eventId/templates')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class TemplatesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Param('eventId') eventId: string) {
    return this.prisma.messageTemplate.findMany({
      where: { eventId },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Get(':id')
  async findOne(@Param('eventId') eventId: string, @Param('id') id: string) {
    const template = await this.prisma.messageTemplate.findFirst({
      where: { id, eventId },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  @Post()
  create(@Param('eventId') eventId: string, @Body() dto: CreateTemplateDto) {
    return this.prisma.messageTemplate.create({
      data: {
        eventId,
        name: dto.name,
        channel: dto.channel as any,
        subject: dto.subject,
        body: dto.body,
      },
    });
  }

  @Patch(':id')
  async update(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    const existing = await this.prisma.messageTemplate.findFirst({ where: { id, eventId } });
    if (!existing) throw new NotFoundException('Template not found');
    return this.prisma.messageTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.channel !== undefined && { channel: dto.channel as any }),
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.body !== undefined && { body: dto.body }),
      },
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('eventId') eventId: string, @Param('id') id: string) {
    const existing = await this.prisma.messageTemplate.findFirst({ where: { id, eventId } });
    if (!existing) throw new NotFoundException('Template not found');
    await this.prisma.messageTemplate.delete({ where: { id } });
  }
}
