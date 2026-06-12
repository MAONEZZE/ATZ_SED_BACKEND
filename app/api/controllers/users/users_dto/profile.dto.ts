import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'João Silva', minLength: 2 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 'minha-instancia' })
  @IsOptional()
  @IsString()
  evolutionInstance?: string;
}
