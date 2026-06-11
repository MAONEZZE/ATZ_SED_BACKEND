import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { PrismaService } from '@database/prisma/prisma.service';
import { CreateFormFieldDto, UpdateFormFieldDto } from '../events_dto/form-field.dto';
import { PaginationQueryDto, Paginated, paginationToSkip } from '@api/common/pagination';

@ApiTags('Form Fields')
@ApiBearerAuth()
@Controller('events/:eventId/form-fields')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class FormFieldsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Listar campos do formulário' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista paginada de campos' })
  async findAll(
    @Param('eventId') eventId: string,
    @Query() pagination: PaginationQueryDto,
  ): Promise<Paginated<object>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = paginationToSkip(page, limit);
    const where = { eventId };
    const [data, total] = await Promise.all([
      this.prisma.formField.findMany({
        where,
        orderBy: { order: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.formField.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  @Post()
  @ApiOperation({ summary: 'Criar campo do formulário' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiResponse({ status: 201, description: 'Campo criado' })
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
  @ApiOperation({ summary: 'Atualizar campo do formulário' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID do campo' })
  @ApiResponse({ status: 200, description: 'Campo atualizado' })
  @ApiResponse({ status: 404, description: 'Campo não encontrado' })
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
        ...(dto.options !== undefined && {
          options: dto.options != null ? (dto.options as Prisma.InputJsonValue) : Prisma.JsonNull,
        }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    });
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Deletar campo do formulário' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID do campo' })
  @ApiResponse({ status: 204, description: 'Campo deletado' })
  async delete(@Param('eventId') eventId: string, @Param('id') id: string) {
    const field = await this.prisma.formField.findFirst({ where: { id, eventId } });
    if (!field) throw new NotFoundException('Form field not found');
    await this.prisma.formField.delete({ where: { id } });
  }
}
