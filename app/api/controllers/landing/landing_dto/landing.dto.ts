import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateLandingSectionDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  content?: unknown;
}
