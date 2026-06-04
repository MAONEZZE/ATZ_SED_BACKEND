import { IsString, IsEnum, IsOptional, IsInt, IsBoolean, Min } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateAutomationDto {
  @IsString()
  templateId!: string;

  @IsEnum([
    'on_registration', 'on_screening', 'on_qualification',
    'on_approval', 'on_rejection', 'on_waitlist',
    'before_event', 'after_event', 'after_approval',
  ])
  trigger!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  delayMinutes?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateAutomationDto extends PartialType(CreateAutomationDto) {}
