import { PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { CreateEventDto } from './create-event.dto';
import { EventStatus } from '@domain/event_module/event.entity';

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @ApiPropertyOptional({ example: 'c1a2b3c4-...' })
  @IsOptional()
  @IsUUID()
  whatsappInstanceId?: string;

  @ApiPropertyOptional({ example: 'token-whatsapp' })
  @IsOptional()
  @IsString()
  whatsappToken?: string;

  @ApiPropertyOptional({
    example: 'uuid-da-pasta',
    description: 'Move o evento para uma pasta do usuário. `null` tira da pasta (raiz).',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o: UpdateEventDto) => o.folderId !== null)
  @IsUUID()
  folderId?: string | null;
}

export class ReorderEventsDto {
  @ApiPropertyOptional({
    example: 'uuid-da-pasta',
    description: 'Escopo da ordenação. Ausente/`null` = eventos fora de pasta (raiz).',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o: ReorderEventsDto) => o.folderId !== null)
  @IsUUID()
  folderId?: string | null;

  @ApiProperty({
    example: ['uuid-evento-2', 'uuid-evento-1'],
    description: 'Ids na ordem desejada. `order` é reescrito como o índice na lista.',
  })
  @IsArray()
  @IsUUID('all', { each: true })
  ids!: string[];
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
