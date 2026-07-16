import { Controller, Get, Patch, Param, Body, UseGuards, ParseEnumPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { OwnershipGuard } from '@shared/guards/ownership.guard';
import { FormsService } from '@modules/events/forms.service';
import { UpdateFormDto } from './dto/form.dto';
import { FormFieldKind } from '@modules/events/form-fields.repository';

const FORM_KINDS = ['registration', 'post_event', 'nps'] as const;

@ApiTags('Forms')
@ApiBearerAuth()
@Controller('events/:eventId/forms/:kind')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class FormsController {
  constructor(private readonly forms: FormsService) {}

  @Get()
  @ApiOperation({ summary: 'Buscar metadados do formulário (description/postRegistrationMessage)' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'kind', enum: FORM_KINDS })
  @ApiResponse({ status: 200, description: 'Metadados do formulário' })
  get(
    @Param('eventId') eventId: string,
    @Param('kind', new ParseEnumPipe(FORM_KINDS)) kind: FormFieldKind,
  ) {
    return this.forms.getOrCreate(eventId, kind);
  }

  @Patch()
  @ApiOperation({ summary: 'Atualizar metadados do formulário' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'kind', enum: FORM_KINDS })
  @ApiResponse({ status: 200, description: 'Metadados atualizados' })
  update(
    @Param('eventId') eventId: string,
    @Param('kind', new ParseEnumPipe(FORM_KINDS)) kind: FormFieldKind,
    @Body() dto: UpdateFormDto,
  ) {
    return this.forms.update(eventId, kind, dto);
  }
}
