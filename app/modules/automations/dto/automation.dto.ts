import { IsString, IsIn, IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { PartialType, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const AUTOMATION_TRIGGERS = [
  'on_registration',
  'on_post_event',
  'on_nps',
  'on_approval',
  'on_rejection',
  'after_approval',
  'before_event',
  'after_event',
] as const;

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

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateAutomationDto extends PartialType(CreateAutomationDto) {}
