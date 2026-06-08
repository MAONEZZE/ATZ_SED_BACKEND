import { IsString, IsOptional, IsInt, IsDateString, MinLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEventDto {
  @ApiProperty({ example: 'Meu Evento Incrível', minLength: 3 })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiPropertyOptional({ example: 'Descrição do evento' })
  @IsOptional()
  @IsString()
  description?: string;

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

  @ApiPropertyOptional({ example: 'Obrigado por se inscrever!' })
  @IsOptional()
  @IsString()
  postRegistrationMessage?: string;
}
