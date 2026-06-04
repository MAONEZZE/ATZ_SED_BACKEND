import {
  IsString, IsEnum, IsOptional, IsBoolean, IsInt, Min,
} from 'class-validator';
import { PartialType, OmitType } from '@nestjs/mapped-types';

export class CreateFormFieldDto {
  @IsString()
  label!: string;

  @IsEnum(['text', 'textarea', 'email', 'phone', 'select', 'multiselect', 'checkbox', 'image', 'date'])
  type!: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  options?: unknown;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateFormFieldDto extends PartialType(OmitType(CreateFormFieldDto, ['type'] as const)) {
  // type cannot be changed for existing fields (especially fixed ones)
}
