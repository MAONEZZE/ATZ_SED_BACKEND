import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsBoolean,
  IsIn,
  IsUUID,
  MinLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEventDto {
  @ApiProperty({ example: 'Meu Evento Incrível', minLength: 3 })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiPropertyOptional({ example: 'São Paulo, SP' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ example: 'Social' })
  @IsOptional()
  @IsString()
  dressCode?: string;

  @ApiPropertyOptional({ example: 'https://chat.whatsapp.com/...' })
  @IsOptional()
  @IsString()
  groupLink?: string;

  @ApiPropertyOptional({ example: '2026-12-31T20:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Se true, inscrições deste evento enviam o payload ao webhook do Pipedrive',
  })
  @IsOptional()
  @IsBoolean()
  sendToPipedrive?: boolean;

  @ApiPropertyOptional({
    example: 'WEEKLY',
    enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'],
    description: 'Frequência de recorrência do convite .ics ({{invite_recorrente}})',
  })
  @IsOptional()
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'])
  recurrenceFreq?: string;

  @ApiPropertyOptional({ example: 1, description: 'Intervalo entre repetições (default 1)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  recurrenceInterval?: number;

  @ApiPropertyOptional({
    example: '2026-12-31T20:00:00.000Z',
    description: 'Data limite da recorrência',
  })
  @IsOptional()
  @IsDateString()
  recurrenceUntil?: string;

  @ApiPropertyOptional({ example: 'c1a2b3c4-...' })
  @IsOptional()
  @IsUUID()
  evolutionInstanceId?: string;
}
