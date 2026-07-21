import { IsString, IsOptional, IsUrl, IsBoolean } from 'class-validator';
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

  @ApiPropertyOptional({ example: 'https://exemplo.com/pos-inscricao' })
  @IsOptional()
  @IsUrl()
  linkPostSubscription?: string;

  @ApiPropertyOptional({ example: true, description: 'Exige consentimento de uso de imagem no formulário' })
  @IsOptional()
  @IsBoolean()
  requireImageAuthorization?: boolean;
}
