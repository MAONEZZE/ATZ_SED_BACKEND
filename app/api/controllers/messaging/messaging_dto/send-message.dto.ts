import { IsString, IsOptional, IsIn, IsArray, IsEmail, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ManualRecipientDto {
  @ApiProperty({ example: 'João Silva' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'joao@email.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '5511999999999' })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class SendMessageDto {
  @ApiProperty({ enum: ['whatsapp', 'email'], example: 'email' })
  @IsIn(['whatsapp', 'email'])
  channel!: 'whatsapp' | 'email';

  @ApiPropertyOptional({ example: 'uuid-do-template' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ example: 'Assunto do email' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ example: 'Conteúdo da mensagem' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ example: ['uuid-inscricao-1', 'uuid-inscricao-2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  registrationIds?: string[];

  @ApiPropertyOptional({ type: [ManualRecipientDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualRecipientDto)
  manualRecipients?: ManualRecipientDto[];
}
