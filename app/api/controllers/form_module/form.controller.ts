import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { FormService } from '@application/form_module/form.service';
import { CreateFormDto, ReorderFormsDto, UpdateFormDto } from '@api/dto/form_module/form.dto';

@ApiTags('Forms')
@ApiBearerAuth()
@Controller('events/:eventId/forms')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class FormController {
  constructor(private readonly forms: FormService) {}

  @Get()
  @ApiOperation({ summary: 'Listar formulários do evento (ordenados por order)' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  list(@Param('eventId') eventId: string) {
    return this.forms.list(eventId);
  }

  @Post()
  @ApiOperation({ summary: 'Criar formulário (o slug público vem do nome)' })
  @ApiResponse({ status: 201, description: 'Formulário criado' })
  @ApiResponse({ status: 409, description: 'Já existe formulário com esse slug no evento' })
  create(@Param('eventId') eventId: string, @Body() dto: CreateFormDto) {
    return this.forms.create(eventId, dto);
  }

  // Antes do :formId — declarada depois, 'reorder' cairia no parâmetro.
  @Patch('reorder')
  @HttpCode(204)
  @ApiOperation({ summary: 'Reordenar formulários do evento' })
  reorder(@Param('eventId') eventId: string, @Body() dto: ReorderFormsDto) {
    return this.forms.reorder(eventId, dto.ids);
  }

  @Get(':formId')
  @ApiOperation({ summary: 'Buscar formulário do evento' })
  @ApiResponse({ status: 404, description: 'Formulário não encontrado' })
  findOne(@Param('eventId') eventId: string, @Param('formId') formId: string) {
    return this.forms.findOne(formId, eventId);
  }

  @Patch(':formId')
  @ApiOperation({ summary: 'Atualizar formulário (renomear troca o slug público)' })
  @ApiResponse({ status: 409, description: 'Slug em uso por outro formulário do evento' })
  update(
    @Param('eventId') eventId: string,
    @Param('formId') formId: string,
    @Body() dto: UpdateFormDto,
  ) {
    return this.forms.update(formId, eventId, dto);
  }

  @Delete(':formId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Deletar formulário (leva campos e respostas por cascata)' })
  delete(@Param('eventId') eventId: string, @Param('formId') formId: string) {
    return this.forms.delete(formId, eventId);
  }
}
