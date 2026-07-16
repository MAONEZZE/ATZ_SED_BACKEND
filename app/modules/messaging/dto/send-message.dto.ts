import {
  IsString,
  IsOptional,
  IsIn,
  IsArray,
  IsEmail,
  IsUUID,
  IsInt,
  IsBoolean,
  IsISO8601,
  Min,
  Matches,
  ValidateNested,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InviteRecurrenceDto {
  @ApiProperty({ enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'], example: 'WEEKLY' })
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'])
  freq!: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

  @ApiProperty({ example: 1, description: 'Intervalo entre repetições (>= 1)' })
  @IsInt()
  @Min(1)
  interval!: number;

  @ApiPropertyOptional({
    example: '2026-12-31T20:00:00.000Z',
    description: 'ISO 8601. Sem valor = recorrência infinita.',
  })
  @IsOptional()
  @IsISO8601()
  until?: string;
}

export class InviteConfigDto {
  @ApiProperty({ example: '2026-07-01', description: 'Data do evento (YYYY-MM-DD)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date deve ser YYYY-MM-DD' })
  date!: string;

  @ApiPropertyOptional({ example: false, description: 'Evento de dia inteiro (ignora horários)' })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional({ example: '09:00', description: 'HH:mm — obrigatório se allDay=false' })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime deve ser HH:mm' })
  startTime?: string;

  @ApiPropertyOptional({ example: '10:00', description: 'HH:mm — obrigatório se allDay=false' })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime deve ser HH:mm' })
  endTime?: string;

  @ApiProperty({ example: 'America/Sao_Paulo', description: 'Timezone IANA' })
  @IsString()
  timezone!: string;

  @ApiPropertyOptional({ type: InviteRecurrenceDto, description: 'Ausente/null = convite único' })
  @IsOptional()
  @ValidateNested()
  @Type(() => InviteRecurrenceDto)
  recurrence?: InviteRecurrenceDto | null;
}

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

export class AttachmentRefDto {
  @ApiProperty({ example: 'message-attachments/uuid-user/uuid-arquivo.pdf', description: 'path retornado por POST /messages/attachments' })
  @IsString()
  path!: string;

  @ApiProperty({ example: 'contrato.pdf' })
  @IsString()
  filename!: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  mimetype!: string;
}

function HasEventOrInstance(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'hasEventOrInstance',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(_value: unknown, args: ValidationArguments) {
          const item = args.object as SendMessageDto;
          return Boolean(item.eventId || item.instanceId);
        },
        defaultMessage() {
          return 'Informe eventId ou instanceId';
        },
      },
    });
  };
}

export class SendMessageDto {
  @ApiPropertyOptional({
    example: 'uuid-do-evento',
    description: 'Vincula disparo a um evento. Opcional (exige instanceId se ausente).',
  })
  @IsOptional()
  @IsUUID()
  @HasEventOrInstance()
  eventId?: string;

  @ApiPropertyOptional({
    example: 'uuid-da-instancia',
    description: 'Instância Evolution a usar quando não há eventId.',
  })
  @IsOptional()
  @IsUUID()
  instanceId?: string;

  @ApiProperty({ enum: ['whatsapp', 'email'], example: 'whatsapp' })
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

  @ApiPropertyOptional({ example: 'Conteúdo da mensagem. Suporta {{name}}, {{event.title}}.' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({
    example: ['uuid-inscricao-1', 'uuid-inscricao-2'],
    description: 'Só válido com eventId.',
  })
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

  @ApiPropertyOptional({
    type: InviteConfigDto,
    description: 'Config do convite .ics. Ausente = comportamento atual (deriva do evento).',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => InviteConfigDto)
  invite?: InviteConfigDto;

  @ApiPropertyOptional({ type: [AttachmentRefDto], description: 'Anexos previamente enviados via POST /messages/attachments.' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentRefDto)
  attachments?: AttachmentRefDto[];
}
