import { IsString, IsEnum, IsOptional, MinLength } from 'class-validator';
import { PartialType, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Confirmação de inscrição' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ enum: ['whatsapp', 'email'], example: 'email' })
  @IsEnum(['whatsapp', 'email'])
  channel!: string;

  @ApiPropertyOptional({ example: 'Sua inscrição foi confirmada!' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ example: 'Olá {{name}}, sua inscrição foi confirmada.' })
  @IsString()
  @MinLength(1)
  body!: string;
}

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {}
