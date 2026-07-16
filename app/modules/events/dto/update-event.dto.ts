import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { CreateEventDto } from './create-event.dto';
import { EventStatus } from '@modules/events/entities/event.entity';

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @ApiPropertyOptional({ example: 'c1a2b3c4-...' })
  @IsOptional()
  @IsUUID()
  evolutionInstanceId?: string;

  @ApiPropertyOptional({ example: 'token-evolution-api' })
  @IsOptional()
  @IsString()
  evolutionToken?: string;
}

export class UpdateEventStatusDto {
  @ApiProperty({ enum: ['draft', 'published', 'cancelled', 'ended'], example: 'published' })
  @IsIn(['draft', 'published', 'cancelled', 'ended'])
  status!: EventStatus;

  @ApiPropertyOptional({
    description: 'Só para status=cancelled: notifica os participantes do cancelamento.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  notifyParticipants?: boolean;
}
