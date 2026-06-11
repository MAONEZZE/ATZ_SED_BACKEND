import { IsString, IsEnum, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { PartialType, OmitType, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFormFieldDto {
  @ApiProperty({ example: 'Nome completo' })
  @IsString()
  label!: string;

  @ApiProperty({
    enum: [
      'text',
      'textarea',
      'email',
      'phone',
      'select',
      'multiselect',
      'checkbox',
      'image',
      'date',
    ],
    example: 'text',
  })
  @IsEnum([
    'text',
    'textarea',
    'email',
    'phone',
    'select',
    'multiselect',
    'checkbox',
    'image',
    'date',
  ])
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

export class UpdateFormFieldDto extends PartialType(
  OmitType(CreateFormFieldDto, ['type'] as const),
) {}
