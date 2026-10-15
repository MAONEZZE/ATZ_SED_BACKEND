import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsIn,
  IsUUID,
  MinLength,
  Min,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EVENT_SLUG_REGEX } from '@domain/event_module/event.entity';

export class CreateEventDto {
  @ApiProperty({ example: 'Meu Evento Incrível', minLength: 3 })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiPropertyOptional({
    example: 'meu-evento-2026',
    description:
      'Slug público do evento (URL). Omitido no POST: gerado a partir do título. ' +
      'Trocar o slug quebra links já divulgados.',
    minLength: 3,
    maxLength: 100,
    pattern: EVENT_SLUG_REGEX.source,
  })
  @IsOptional()
  @IsString()
  @Length(3, 100)
  @Matches(EVENT_SLUG_REGEX, {
    message: 'slug must contain only lowercase letters, digits and single hyphens',
  })
  slug?: string;

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
  whatsappInstanceId?: string;
}
