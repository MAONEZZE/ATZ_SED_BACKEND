import { IsString, IsEnum, IsOptional, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateTemplateDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(['whatsapp', 'email'])
  channel!: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  @MinLength(1)
  body!: string;
}

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {}
