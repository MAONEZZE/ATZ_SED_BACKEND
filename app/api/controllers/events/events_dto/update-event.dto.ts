import { PartialType } from '@nestjs/mapped-types';
import { IsEnum } from 'class-validator';
import { CreateEventDto } from './create-event.dto';
import { IsOptional, IsString } from 'class-validator';

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
  status!: string;
}
