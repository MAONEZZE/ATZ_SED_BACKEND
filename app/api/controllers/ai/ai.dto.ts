import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateEmailStyleDto {
  @ApiProperty({ example: 'Conteúdo do email para gerar variações de estilo', minLength: 10 })
  @IsString()
  @MinLength(10)
  content!: string;
}
