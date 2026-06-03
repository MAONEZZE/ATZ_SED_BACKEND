import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CreateEventDto } from './create-event.dto';
import { EventStatus } from '@domain/events/entities/event.entity';

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @IsOptional()
  @IsString()
  evolutionInstance?: string;

  @IsOptional()
  @IsString()
  evolutionToken?: string;
}

export class UpdateEventStatusDto {
  @IsEnum(['draft', 'published', 'cancelled', 'ended'])
  status!: EventStatus;
}
