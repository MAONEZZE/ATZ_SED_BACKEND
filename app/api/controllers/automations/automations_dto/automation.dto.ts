import { IsString, IsEnum, IsOptional, IsInt, IsBoolean, Min } from 'class-validator';
import { PartialType, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAutomationDto {
  @ApiProperty({ example: 'uuid-do-template' })
  @IsString()
  templateId!: string;

  @ApiProperty({
    enum: [
      'on_registration',
      'on_approval',
      'on_rejection',
      'before_event',
      'after_event',
    ],
    example: 'on_registration',
  })
  @IsEnum([
    'on_registration',
    'on_approval',
    'on_rejection',
    'before_event',
    'after_event',
  ])
  trigger!: string;

  @ApiPropertyOptional({ example: 0, description: 'Minutos de delay após o trigger' })
  @IsOptional()
  @IsInt()
  @Min(0)
  delayMinutes?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateAutomationDto extends PartialType(CreateAutomationDto) {}
