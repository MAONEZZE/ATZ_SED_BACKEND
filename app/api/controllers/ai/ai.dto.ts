import { IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateEmailStyleDto {
  @ApiProperty({ example: 'Conteúdo do email para gerar variações de estilo', minLength: 10 })
  @IsString()
  @MinLength(10)
  content!: string;
}

export class LandingChatDto {
  @ApiProperty({ example: 'Como posso melhorar minha landing page?' })
  @IsString()
  @MinLength(1)
  message!: string;

  @ApiPropertyOptional({ description: 'Dados da landing page para contexto' })
  landing: unknown;
}
