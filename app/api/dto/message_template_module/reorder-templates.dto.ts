import { IsArray, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReorderTemplatesDto {
  @ApiPropertyOptional({
    example: 'uuid-da-pasta',
    description: 'Pasta onde reordenar. Ausente ou `null` reordena os templates fora de pasta.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o: ReorderTemplatesDto) => o.folderId !== null)
  @IsUUID()
  folderId?: string | null;

  @ApiProperty({
    example: ['uuid-template-2', 'uuid-template-1'],
    description: 'Ids na ordem desejada. `order` é reescrito como o índice na lista.',
  })
  @IsArray()
  @IsUUID('all', { each: true })
  ids!: string[];
}
