import {
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
  IsIn,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGlobalTemplateDto {
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

  @ApiPropertyOptional({ description: 'Config visual (blob opaco). Só e-mail preenche.' })
  @IsOptional()
  @IsObject()
  layoutConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['minimalista', 'profissional', 'acolhedor', 'elegante'] })
  @IsOptional()
  @IsIn(['minimalista', 'profissional', 'acolhedor', 'elegante'])
  styleKey?: string;

  @ApiPropertyOptional({
    example: 'uuid-do-evento',
    description: 'Vincula o template a um evento (opcional). Sem valor = template global.',
  })
  @IsOptional()
  @IsUUID()
  eventId?: string;
}

export class UpdateGlobalTemplateDto {
  @ApiPropertyOptional({ example: 'Confirmação de inscrição' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ enum: ['whatsapp', 'email'], example: 'email' })
  @IsOptional()
  @IsEnum(['whatsapp', 'email'])
  channel?: string;

  @ApiPropertyOptional({ example: 'Sua inscrição foi confirmada!' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ example: 'Olá {{name}}, sua inscrição foi confirmada.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  @ApiPropertyOptional({ description: 'Config visual (blob opaco). Só e-mail preenche.' })
  @IsOptional()
  @IsObject()
  layoutConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['minimalista', 'profissional', 'acolhedor', 'elegante'] })
  @IsOptional()
  @IsIn(['minimalista', 'profissional', 'acolhedor', 'elegante'])
  styleKey?: string;

  @ApiPropertyOptional({
    example: 'uuid-do-evento',
    description: 'Vincula/desvincula o template de um evento. null = desvincular.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o) => o.eventId !== null)
  @IsUUID()
  eventId?: string | null;
}
