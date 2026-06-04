import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, HttpCode,
  NotFoundException, BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { PrismaService } from '@database/prisma/prisma.service';
import { CreateFormFieldDto, UpdateFormFieldDto } from '../events_dto/form-field.dto';

@Controller('events/:eventId/form-fields')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class FormFieldsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Param('eventId') eventId: string) {
    return this.prisma.formField.findMany({
      where: { eventId },
      orderBy: { order: 'asc' },
    });
  }

  @Post()
  create(@Param('eventId') eventId: string, @Body() dto: CreateFormFieldDto) {
    return this.prisma.formField.create({
      data: {
        eventId,
        label: dto.label,
        type: dto.type as any,
        required: dto.required ?? true,
        options: dto.options != null ? (dto.options as Prisma.InputJsonValue) : Prisma.JsonNull,
        order: dto.order ?? 99,
        isFixed: false,
      },
    });
  }

  @Patch(':id')
  async update(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFormFieldDto,
  ) {
    const field = await this.prisma.formField.findFirst({ where: { id, eventId } });
    if (!field) throw new NotFoundException('Form field not found');

    return this.prisma.formField.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.required !== undefined && { required: dto.required }),
        ...(dto.options !== undefined && { options: dto.options != null ? (dto.options as Prisma.InputJsonValue) : Prisma.JsonNull }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('eventId') eventId: string, @Param('id') id: string) {
    const field = await this.prisma.formField.findFirst({ where: { id, eventId } });
    if (!field) throw new NotFoundException('Form field not found');
    if (field.isFixed) throw new BadRequestException('Fixed form fields cannot be deleted');
    await this.prisma.formField.delete({ where: { id } });
  }
}
