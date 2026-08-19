import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFormDto {
  @ApiProperty({ example: 'Pesquisa de satisfação', description: 'O slug público é derivado daqui.' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Conte como foi sua experiência' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Obrigado por responder!' })
  @IsOptional()
  @IsString()
  postRegistrationMessage?: string;

  @ApiPropertyOptional({ example: 'https://exemplo.com/proximos-passos' })
  @IsOptional()
  @IsUrl()
  linkPostSubscription?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Exige consentimento de uso de imagem para criar o inscrito por este formulário.',
  })
  @IsOptional()
  @IsBoolean()
  requireImageAuthorization?: boolean;
}

export class UpdateFormDto {
  @ApiPropertyOptional({ example: 'Pesquisa de satisfação (v2)', description: 'Renomear reescreve o slug público.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postRegistrationMessage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  linkPostSubscription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireImageAuthorization?: boolean;
}

export class ReorderFormsDto {
  @ApiProperty({ example: ['uuid-form-2', 'uuid-form-1'], description: '`order` = índice na lista.' })
  @IsArray()
  @IsUUID('all', { each: true })
  ids!: string[];
}

export class SubmitFormResponseDto {
  @ApiProperty({ example: '11999998888', description: 'Identidade do respondente; casa com o inscrito do evento.' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { nome: 'João Silva', email: 'joao@email.com', Nota: '9' },
    description: 'Respostas chaveadas pelo label do campo.',
  })
  @IsObject()
  answers!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Sobrepõe o padrão do evento no envio ao Pipedrive.' })
  @IsOptional()
  @IsBoolean()
  send_to_pipedrive?: boolean;

  @ApiPropertyOptional({ description: 'Consentimento de uso de imagem, quando o formulário exige.' })
  @IsOptional()
  @IsBoolean()
  image_authorization?: boolean;
}
