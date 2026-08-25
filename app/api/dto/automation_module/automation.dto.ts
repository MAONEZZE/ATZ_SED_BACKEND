import {
  IsString,
  IsIn,
  IsOptional,
  IsInt,
  IsArray,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  Matches,
  registerDecorator,
  ValidationOptions,
  ValidateIf,
  IsUUID,
  IsISO8601,
} from 'class-validator';
import { OmitType, PartialType, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IANAZone } from 'luxon';
import { AUTOMATION_TRIGGERS } from '@domain/automation_module/automation-rule.entity';
import { PaginationQueryDto } from '@api/dto/shared/pagination';

// 5-field cron: minute hour day-of-month month day-of-week.
const CRON_RE = /^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/;

function IsCronExpression(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isCronExpression',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && CRON_RE.test(value.trim());
        },
        defaultMessage() {
          return 'cron deve ter 5 campos (ex: "0 9 * * 1")';
        },
      },
    });
  };
}

function IsIanaTimezone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isIanaTimezone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && IANAZone.isValidZone(value);
        },
        defaultMessage() {
          return 'timezone deve ser uma IANA zone válida (ex: "America/Sao_Paulo")';
        },
      },
    });
  };
}

export class CreateAutomationDto {
  @ApiProperty({ example: 'uuid-do-template' })
  @IsString()
  templateId!: string;

  @ApiProperty({ enum: AUTOMATION_TRIGGERS, example: 'on_registration' })
  @IsIn(AUTOMATION_TRIGGERS)
  trigger!: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['uuid-do-formulario-1', 'uuid-do-formulario-2'],
    description:
      'Vale nos 7 gatilhos. Ausente/vazio = todos os formulários do evento, inclusive os criados depois. Obrigatório (não-vazio) em "on_form_submitted" e "on_date_form_field". Em "on_registration"/"on_form_submitted" o critério é o formulário da submissão; nos outros (on_approval, on_rejection, recurring, on_date, on_date_form_field) é participação — o inscrito respondeu algum dos formulários da regra; inscrito criado pelo painel (sem FormResponse) não é alcançado por regra escopada. Formulário anônimo é sempre recusado (400). "on_date_form_field" também exige que o formulário tenha um campo on_date_automation_field.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  formIds?: string[];

  @ApiPropertyOptional({
    example: 0,
    description:
      'Minutos de delay após o trigger. Só 0/ausente (disparo imediato) é aceito hoje — não há worker agendado para delay > 0.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(0)
  delayMinutes?: number;

  @ApiPropertyOptional({
    example: '0 9 * * 1',
    description: 'Cron (5 campos) — obrigatório quando trigger="recurring"',
  })
  @IsOptional()
  @IsString()
  @IsCronExpression()
  cron?: string;

  @ApiPropertyOptional({
    example: 'America/Sao_Paulo',
    description:
      'IANA timezone — obrigatório quando trigger="recurring"; opcional em "on_date" (default America/Sao_Paulo)',
  })
  @IsOptional()
  @IsString()
  @IsIanaTimezone()
  timezone?: string;

  @ApiPropertyOptional({
    example: '2026-02-12T09:00:00',
    description:
      'Instante do disparo único — obrigatório quando trigger="on_date". Lido no `timezone` da regra (default America/Sao_Paulo). Data no passado → 400.',
  })
  @IsOptional()
  @IsISO8601()
  sendAt?: string;

  @ApiPropertyOptional({
    example: '09:00',
    description:
      'Hora do disparo mensal — obrigatório só quando trigger="on_date_form_field" (default 09:00 se ausente). Lida no `timezone` da regra.',
  })
  @IsOptional()
  @IsString()
  // Mais estrita que a de send-message.dto.ts de propósito: "25:99" tem que
  // morrer no DTO, ninguém revalida depois.
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'sendTime deve ser HH:mm (00:00–23:59)' })
  sendTime?: string;

  @ApiPropertyOptional({ example: 'Cobrança mensal' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    example: 'uuid-da-pasta',
    description: 'Pasta que organiza a regra. Tem que ser pasta de automação do mesmo evento.',
  })
  @IsOptional()
  @IsUUID()
  folderId?: string;
}

// `folderId` sai da base e volta redeclarado porque aqui ele aceita `null`
// explícito (tirar da pasta), o que o tipo da criação não permite.
export class UpdateAutomationDto extends PartialType(
  OmitType(CreateAutomationDto, ['folderId'] as const),
) {
  @ApiPropertyOptional({
    example: 'uuid-da-pasta',
    description: 'Move a regra de pasta. `null` tira da pasta.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o: UpdateAutomationDto) => o.folderId !== null)
  @IsUUID()
  folderId?: string | null;
}

export class ListAutomationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    type: String,
    description: "Filtra por pasta. 'null' retorna só as regras fora de pasta.",
  })
  @IsOptional()
  @IsString()
  folderId?: string;
}

export class ReorderAutomationsDto {
  @ApiPropertyOptional({
    example: 'uuid-da-pasta',
    description: 'Pasta onde reordenar. Ausente ou `null` reordena as regras fora de pasta.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o: ReorderAutomationsDto) => o.folderId !== null)
  @IsUUID()
  folderId?: string | null;

  @ApiProperty({
    example: ['uuid-regra-2', 'uuid-regra-1'],
    description: 'Ids na ordem desejada. `order` é reescrito como o índice na lista.',
  })
  @IsArray()
  @IsUUID('all', { each: true })
  ids!: string[];
}
