import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RegistrationService } from '@application/registration_module/registration.service';
import { FormService } from '@application/form_module/form.service';
import { FormFieldService } from '@application/form_field_module/form-field.service';
import { SubmitFormResponseDto } from '@api/dto/form_module/form.dto';

@ApiTags('Public')
@Controller('public/events')
export class PublicFormController {
  constructor(
    private readonly registrations: RegistrationService,
    private readonly forms: FormService,
    private readonly formFields: FormFieldService,
  ) {}

  @Get(':slug/forms')
  @ApiOperation({ summary: 'Listar formulários públicos do evento' })
  @ApiParam({ name: 'slug', description: 'Slug do evento' })
  async listForms(@Param('slug') slug: string) {
    const event = await this.registrations.publicEventBySlug(slug);
    const forms = await this.forms.list(event.id);
    return forms.map((f) => ({
      id: f.id,
      name: f.name,
      slug: f.slug,
      order: f.order,
      description: f.description,
      requireImageAuthorization: f.requireImageAuthorization,
    }));
  }

  @Get(':slug/forms/:formSlug/fields')
  @ApiOperation({ summary: 'Campos de um formulário público, na ordem de renderização' })
  @ApiResponse({ status: 404, description: 'Formulário não encontrado' })
  async fields(@Param('slug') slug: string, @Param('formSlug') formSlug: string) {
    const form = await this.forms.findPublic(slug, formSlug);
    return this.formFields.publicFields(form.id);
  }

  @Post(':slug/forms/:formSlug/responses')
  @HttpCode(201)
  @ApiOperation({
    summary:
      'Responder um formulário público. O telefone identifica o inscrito; sem match, o inscrito é criado.',
  })
  @ApiResponse({ status: 201, description: '{ registrationId, created }' })
  @ApiResponse({
    status: 400,
    description: 'Campo obrigatório ausente, telefone vazio, capacidade esgotada ou autorização de imagem obrigatória',
  })
  @ApiResponse({ status: 404, description: 'Evento ou formulário não encontrado' })
  async submit(
    @Param('slug') slug: string,
    @Param('formSlug') formSlug: string,
    @Body() dto: SubmitFormResponseDto,
  ) {
    const { registration, created } = await this.registrations.submitForm(
      slug,
      formSlug,
      dto.phone,
      dto.answers,
      { sendToPipedrive: dto.send_to_pipedrive, imageAuthorization: dto.image_authorization },
    );
    return { registrationId: registration.id, created };
  }
}
