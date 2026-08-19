import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FOLDER_RESOURCE_TYPES,
  FolderResourceType,
} from '@domain/folder_module/folder-resource-type';

/**
 * `resourceType` ausente cai em `event`, que é o que as chamadas antigas
 * (quando só existia pasta de evento) esperam. Em `/events/:eventId/folders` o
 * tipo `event` é inválido — pasta de evento mora no painel — e a resposta é 400.
 */
const RESOURCE_TYPE_DOC = {
  enum: FOLDER_RESOURCE_TYPES,
  example: 'event',
  description: 'Que tipo de registro a pasta organiza. Ausente = `event`.',
};

export class ListFoldersQueryDto {
  @ApiPropertyOptional(RESOURCE_TYPE_DOC)
  @IsOptional()
  @IsIn(FOLDER_RESOURCE_TYPES)
  resourceType?: FolderResourceType;
}

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

  @ApiPropertyOptional(RESOURCE_TYPE_DOC)
  @IsOptional()
  @IsIn(FOLDER_RESOURCE_TYPES)
  resourceType?: FolderResourceType;
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
  @ApiPropertyOptional({
    example: 'uuid-da-pasta-pai',
    description:
      'Nível sendo reordenado. Ausente ou `null` reordena as pastas da raiz. Id de outro nível é ignorado.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o: ReorderFoldersDto) => o.parentId !== null)
  @IsUUID()
  parentId?: string | null;

  @ApiProperty({
    example: ['uuid-pasta-2', 'uuid-pasta-1'],
    description:
      'Ids **irmãos** na ordem desejada. `order` é reescrito como o índice na lista.',
  })
  @IsArray()
  @IsUUID('all', { each: true })
  ids!: string[];

  @ApiPropertyOptional(RESOURCE_TYPE_DOC)
  @IsOptional()
  @IsIn(FOLDER_RESOURCE_TYPES)
  resourceType?: FolderResourceType;
}
