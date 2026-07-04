import { IsString, IsIn, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { PartialType, OmitType, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
] as const;

export class CreateFormFieldDto {
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

  @ApiPropertyOptional({ enum: ['registration', 'post_event', 'nps'], example: 'registration' })
  @IsOptional()
  @IsIn(['registration', 'post_event', 'nps'])
  kind?: 'registration' | 'post_event' | 'nps';
}

export class UpdateFormFieldDto extends PartialType(
  OmitType(CreateFormFieldDto, ['type'] as const),
) {}
