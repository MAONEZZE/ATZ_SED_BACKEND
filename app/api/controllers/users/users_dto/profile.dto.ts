import { IsString, IsOptional, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  evolutionInstance?: string;

  @IsOptional()
  @IsString()
  evolutionToken?: string;
}
