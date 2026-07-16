import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFormDto {
  @ApiPropertyOptional({ example: 'Descrição do evento' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Obrigado por se inscrever!' })
  @IsOptional()
  @IsString()
  postRegistrationMessage?: string;
}
