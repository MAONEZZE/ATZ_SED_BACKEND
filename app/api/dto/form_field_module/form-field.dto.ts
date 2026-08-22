import { IsString, IsIn, IsOptional, IsBoolean, IsInt, Min, IsUUID } from 'class-validator';
import { PartialType, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const FORM_FIELD_TYPES = [
  'text',
  'textarea',
  'email',
  'phone',
  'select',
  'multiselect',
  'checkbox',
  'image',
  'date',
  'linkedin',
  'instagram',
  'on_date_automation_field',
] as const;

export class CreateFormFieldDto {
  @ApiProperty({ example: 'uuid-do-formulario', description: 'Formulário do evento onde o campo entra.' })
  @IsUUID()
  formId!: string;

  @ApiProperty({ example: 'Nome completo' })
  @IsString()
  label!: string;

  @ApiProperty({ enum: FORM_FIELD_TYPES, example: 'text' })
  @IsIn(FORM_FIELD_TYPES)
  type!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ example: ['Opção 1', 'Opção 2'] })
  @IsOptional()
  options?: unknown;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

}

export class UpdateFormFieldDto extends PartialType(CreateFormFieldDto) {}
