import { IsString, IsIn, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { PartialType, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FORM_KINDS, FormKind } from '@domain/shared/form-kind.type';

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

  @ApiPropertyOptional({ enum: FORM_KINDS, example: 'registration' })
  @IsOptional()
  @IsIn(FORM_KINDS)
  kind?: FormKind;
}

export class UpdateFormFieldDto extends PartialType(CreateFormFieldDto) {}
