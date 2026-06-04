import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, HttpCode, NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { PrismaService } from '@database/prisma/prisma.service';
import { CreateAutomationDto, UpdateAutomationDto } from '../automations_dto/automation.dto';

@Controller('events/:eventId/automations')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class AutomationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Param('eventId') eventId: string) {
    return this.prisma.automationRule.findMany({
      where: { eventId },
      include: { template: { select: { id: true, name: true, channel: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Get(':id')
  async findOne(@Param('eventId') eventId: string, @Param('id') id: string) {
    const rule = await this.prisma.automationRule.findFirst({
      where: { id, eventId },
      include: { template: true },
    });
    if (!rule) throw new NotFoundException('Automation rule not found');
    return rule;
  }

  @Post()
  async create(@Param('eventId') eventId: string, @Body() dto: CreateAutomationDto) {
    // Verify template belongs to this event
    const template = await this.prisma.messageTemplate.findFirst({
      where: { id: dto.templateId, eventId },
    });
    if (!template) throw new NotFoundException('Template not found in this event');

    return this.prisma.automationRule.create({
      data: {
        eventId,
        templateId: dto.templateId,
        trigger: dto.trigger as any,
        delayMinutes: dto.delayMinutes,
        active: dto.active ?? true,
      },
      include: { template: { select: { id: true, name: true, channel: true } } },
    });
  }

  @Patch(':id')
  async update(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    const existing = await this.prisma.automationRule.findFirst({ where: { id, eventId } });
    if (!existing) throw new NotFoundException('Automation rule not found');

    if (dto.templateId) {
      const template = await this.prisma.messageTemplate.findFirst({
        where: { id: dto.templateId, eventId },
      });
      if (!template) throw new NotFoundException('Template not found in this event');
    }

    return this.prisma.automationRule.update({
      where: { id },
      data: {
        ...(dto.templateId && { templateId: dto.templateId }),
        ...(dto.trigger && { trigger: dto.trigger as any }),
        ...(dto.delayMinutes !== undefined && { delayMinutes: dto.delayMinutes }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
      include: { template: { select: { id: true, name: true, channel: true } } },
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('eventId') eventId: string, @Param('id') id: string) {
    const existing = await this.prisma.automationRule.findFirst({ where: { id, eventId } });
    if (!existing) throw new NotFoundException('Automation rule not found');
    await this.prisma.automationRule.delete({ where: { id } });
  }
}
