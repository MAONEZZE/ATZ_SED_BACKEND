import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFolderDto {
  @ApiProperty({ example: 'Eventos 2026' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    example: 'uuid-da-pasta-pai',
    description: 'Ausente = pasta na raiz.',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateFolderDto {
  @ApiPropertyOptional({ example: 'Eventos 2027' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    example: 'uuid-da-pasta-pai',
    description: 'Move a pasta. `null` move para a raiz.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o: UpdateFolderDto) => o.parentId !== null)
  @IsUUID()
  parentId?: string | null;
}

export class ReorderFoldersDto {
  @ApiProperty({
    example: ['uuid-pasta-2', 'uuid-pasta-1'],
    description: 'Ids na ordem desejada. `order` é reescrito como o índice na lista.',
  })
  @IsArray()
  @IsUUID('all', { each: true })
  ids!: string[];
}
