import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MoveItemDto {
  @ApiPropertyOptional({
    example: 'uuid-do-irmao',
    description:
      'Item que fica logo depois do arrastado. Ausente = fim da lista. Precisa estar no mesmo escopo (mesma pasta/evento), senão 404.',
  })
  @IsOptional()
  @IsUUID()
  beforeId?: string;
}
