import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  MinLength,
  Min,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  dressCode?: string;

  @IsOptional()
  @IsString()
  groupLink?: string;

  @IsOptional()
  @IsDateString()
  eventDate?: string;
}
