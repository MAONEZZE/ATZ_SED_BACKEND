import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { CreateEventDto } from './create-event.dto';
import { EventStatus } from '@domain/events/entities/event.entity';

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @ApiPropertyOptional({ example: 'minha-instancia' })
  @IsOptional()
  @IsString()
  evolutionInstance?: string;

  @ApiPropertyOptional({ example: 'token-evolution-api' })
  @IsOptional()
  @IsString()
  evolutionToken?: string;
}

export class UpdateEventStatusDto {
  @ApiProperty({ enum: ['draft', 'published', 'cancelled', 'ended'], example: 'published' })
  @IsEnum(['draft', 'published', 'cancelled', 'ended'])
  status!: EventStatus;
}
