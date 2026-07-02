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
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { OwnershipGuard } from '@shared/guards/ownership.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '@shared/authenticated-user.entity';
import { FormFieldsService } from '@modules/events/form-fields.service';
import { CreateFormFieldDto, UpdateFormFieldDto } from './dto/form-field.dto';
import { PaginationQueryDto, Paginated } from '@shared/pagination';

@ApiTags('Form Fields')
@ApiBearerAuth()
@Controller('events/:eventId/form-fields')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class FormFieldsController {
  constructor(private readonly formFields: FormFieldsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar campos do formulário' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'kind', required: false, enum: ['registration', 'post_event', 'nps'] })
  @ApiResponse({ status: 200, description: 'Lista paginada de campos' })
  async findAll(
    @Param('eventId') eventId: string,
    @Query() pagination: PaginationQueryDto,
    @Query('kind') kind?: 'registration' | 'post_event' | 'nps',
  ): Promise<Paginated<object>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const { data, total } = await this.formFields.listPaginated(eventId, kind, page, limit);
    return { data, total, page, limit };
  }

  @Post()
  @ApiOperation({ summary: 'Criar campo do formulário' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiResponse({ status: 201, description: 'Campo criado' })
  create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateFormFieldDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.formFields.create(eventId, user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar campo do formulário' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID do campo' })
  @ApiResponse({ status: 200, description: 'Campo atualizado' })
  @ApiResponse({ status: 404, description: 'Campo não encontrado' })
  update(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFormFieldDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.formFields.update(eventId, id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Deletar campo do formulário' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'id', description: 'UUID do campo' })
  @ApiResponse({ status: 204, description: 'Campo deletado' })
  delete(
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.formFields.delete(eventId, id, user.id);
  }
}
