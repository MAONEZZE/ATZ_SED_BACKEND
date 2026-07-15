import {
  IsString,
  IsIn,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
  Max,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { PartialType, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IANAZone } from 'luxon';

const AUTOMATION_TRIGGERS = [
  'on_registration',
  'on_post_event',
  'on_nps',
  'on_approval',
  'on_rejection',
  'after_approval',
  'before_event',
  'after_event',
  'recurring',
] as const;

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

  @ApiPropertyOptional({ example: 0, description: 'Minutos de delay após o trigger' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
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
    description: 'IANA timezone — obrigatório quando trigger="recurring"',
  })
  @IsOptional()
  @IsString()
  @IsIanaTimezone()
  timezone?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateAutomationDto extends PartialType(CreateAutomationDto) {}
