import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { CurrentUser } from '@api/config/decorators/current-user.decorator';
import { AuthenticatedUser } from '@domain/shared/authenticated-user.entity';
import { MessageTemplateService } from '@application/message_template_module/message-template.service';
import {
  CreateGlobalTemplateDto,
  UpdateGlobalTemplateDto,
} from '@api/dto/message_template_module/global-template.dto';
import { ListTemplatesQueryDto } from '@api/dto/message_template_module/list-templates-query.dto';
import { Paginated } from '@api/dto/shared/pagination';

@ApiTags('Messaging (global)')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class MessageTemplateController {
  constructor(private readonly templates: MessageTemplateService) {}

  @Post('messaging/templates')
  @HttpCode(201)
  @ApiOperation({ summary: 'Criar template' })
  @ApiResponse({ status: 201, description: 'Template criado' })
  createTemplate(@Body() dto: CreateGlobalTemplateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.templates.create(user.id, dto);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Listar templates do usuário' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'eventId',
    required: false,
    type: String,
    description: "Filtra por evento vinculado. 'null' retorna só os templates globais.",
  })
  @ApiQuery({
    name: 'channel',
    required: false,
    enum: ['whatsapp', 'email'],
    description: 'Filtra por canal.',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada de templates' })
  async findTemplates(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTemplatesQueryDto,
  ): Promise<Paginated<object>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { data, total } = await this.templates.list(
      user.id,
      query.eventId,
      page,
      limit,
      query.channel,
    );
    return { data, total, page, limit };
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Buscar template por ID' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiResponse({ status: 200, description: 'Template encontrado' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  findTemplate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.templates.findOne(user.id, id);
  }

  @Patch('templates/:id')
  @ApiOperation({ summary: 'Atualizar template' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiResponse({ status: 200, description: 'Template atualizado' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateGlobalTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.templates.update(user.id, id, dto);
  }

  @Delete('templates/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Deletar template' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiResponse({ status: 204, description: 'Template deletado' })
  deleteTemplate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.templates.delete(user.id, id);
  }
}
