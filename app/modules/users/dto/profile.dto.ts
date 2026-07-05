import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'João Silva', minLength: 2, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'minha-instancia' })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'evolutionInstance não pode ser uma string vazia' })
  evolutionInstance?: string;
}
